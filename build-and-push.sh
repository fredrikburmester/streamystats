#!/bin/bash
set -e

# Configuration
REGISTRY="docker.io/fredrikburmester"
VERSION=${VERSION:-latest}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Hide cursor
tput civis

# Show cursor on exit
trap 'tput cnorm' EXIT

echo -e "${BLUE}StreamyStats v2 Docker Build & Push${NC}"
echo -e "${BLUE}=================================${NC}"
echo "Registry: $REGISTRY"
echo "Version: $VERSION"
echo ""

# Menu options
options=("NextJS App" "Job Server" "All Services")
selected=0

# Function to display menu
display_menu() {
    echo -e "${WHITE}Select which service(s) to build and push:${NC}"
    echo ""
    
    for i in "${!options[@]}"; do
        if [ $i -eq $selected ]; then
            echo -e "${CYAN}  ▶ ${options[$i]}${NC}"
        else
            echo "    ${options[$i]}"
        fi
    done
    
    echo ""
    echo -e "${WHITE}Use ↑/↓ arrows to navigate, Enter to select, q to quit${NC}"
}

# Function to build and push
build_and_push() {
    local dockerfile=$1
    local image_name=$2
    local display_name=$3
    
    echo -e "${YELLOW}Building $display_name...${NC}"
    
    if docker buildx build --platform linux/amd64,linux/arm64 -f "$dockerfile" -t "$REGISTRY/$image_name:$VERSION" --push .; then
        echo -e "${GREEN}✅ $display_name built and pushed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to build/push $display_name${NC}"
        return 1
    fi
}

# Main menu loop
while true; do
    clear
    echo -e "${BLUE}StreamyStats v2 Docker Build & Push${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo "Registry: $REGISTRY"
    echo "Version: $VERSION"
    echo ""
    
    display_menu
    
    # Read single keypress
    read -rsn1 key
    
    case "$key" in
        A) # Up arrow
            ((selected--))
            if [ $selected -lt 0 ]; then
                selected=$((${#options[@]} - 1))
            fi
            ;;
        B) # Down arrow
            ((selected++))
            if [ $selected -ge ${#options[@]} ]; then
                selected=0
            fi
            ;;
        "") # Enter key
            clear
            tput cnorm # Show cursor during build
            
            case $selected in
                0) # NextJS App
                    echo -e "${BLUE}Building NextJS App only...${NC}\n"
                    build_and_push "apps/nextjs-app/Dockerfile" "streamystats-v2-nextjs" "NextJS app"
                    ;;
                1) # Job Server
                    echo -e "${BLUE}Building Job Server only...${NC}\n"
                    build_and_push "apps/job-server/Dockerfile" "streamystats-v2-job-server" "Job server"
                    ;;
                2) # All Services
                    echo -e "${BLUE}Building all services...${NC}\n"
                    
                    # Build in parallel
                    build_and_push "apps/nextjs-app/Dockerfile" "streamystats-v2-nextjs" "NextJS app" &
                    NEXTJS_PID=$!
                    
                    build_and_push "apps/job-server/Dockerfile" "streamystats-v2-job-server" "Job server" &
                    JOBSERVER_PID=$!
                    
                    echo -e "\n${YELLOW}Waiting for all builds to complete...${NC}\n"
                    
                    FAILED=0
                    wait $NEXTJS_PID || FAILED=1
                    wait $JOBSERVER_PID || FAILED=1
                    
                    if [ $FAILED -eq 1 ]; then
                        echo -e "\n${RED}❌ One or more builds failed${NC}"
                        exit 1
                    fi
                    ;;
            esac
            
            echo -e "\n${GREEN}🚀 Build completed!${NC}"
            echo ""
            echo "Built images:"
            case $selected in
                0) echo "  - $REGISTRY/streamystats-v2-nextjs:$VERSION" ;;
                1) echo "  - $REGISTRY/streamystats-v2-job-server:$VERSION" ;;
                2) 
                    echo "  - $REGISTRY/streamystats-v2-nextjs:$VERSION"
                    echo "  - $REGISTRY/streamystats-v2-job-server:$VERSION"
                    ;;
            esac
            
            break
            ;;
        q|Q) # Quit
            echo -e "\n${YELLOW}Build cancelled.${NC}"
            exit 0
            ;;
    esac
done

tput cnorm # Restore cursor
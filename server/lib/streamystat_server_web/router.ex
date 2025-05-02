defmodule StreamystatServerWeb.Router do
  use StreamystatServerWeb, :router
  import Phoenix.LiveDashboard.Router
  import Phoenix.LiveDashboard.Router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  pipeline :auth do
    plug(StreamystatServerWeb.AuthPlug)
  end

  pipeline :admin_auth do
    plug(StreamystatServerWeb.AdminAuthPlug)
  end

  scope "/" do
    pipe_through([:fetch_session, :protect_from_forgery])
    live_dashboard("/dashboard", metrics: StreamystatServerWeb.Telemetry)
  end

  scope "/api", StreamystatServerWeb do
    pipe_through(:api)

    # Public routes
    post("/login", AuthController, :login)
    get("/health", HealthController, :check)
    get("/servers", ServerController, :index)
    get("/servers/:id", ServerController, :show)
    post("/servers", ServerController, :create)

    # Admin routes
    scope "/admin", as: :admin do
      pipe_through(:admin_auth)

      patch("/servers/:id/settings", ServerController, :update_settings)
      delete("/servers/:server_id", ServerController, :delete)
      post("/servers/:server_id/sync/full", SyncController, :full_sync)
      post("/servers/:server_id/sync/users", SyncController, :sync_users)
      post("/servers/:server_id/sync/libraries", SyncController, :sync_libraries)
      post("/servers/:server_id/sync/items", SyncController, :sync_items)
      get("/servers/:server_id/sync/tasks", SyncController, :list_tasks)
      get("/servers/:server_id/sync/tasks/:task_id", SyncController, :show_task)
      get("/servers/:server_id/activities", ActivityController, :index)
      post("/servers/:server_id/tautulli/import", TautulliImportController, :import)
      post("/servers/:server_id/jellystats/import", JellystatsImportController, :import)

      post(
        "/servers/:server_id/playback-reporting/import",
        PlaybackReportingImportController,
        :import
      )
    end

    # Protected routes
    scope "/servers/:server_id", as: :protected do
      pipe_through(:auth)

      get("/active-sessions", ActiveSessionsController, :index)

      get("/backup/export", BackupController, :export)
      post("/backup/import", BackupController, :import)

      get("/statistics", UserStatisticsController, :index)
      get("/statistics/watchtime_per_day", UserStatisticsController, :watchtime_per_day)
      get("/statistics/history", UserStatisticsController, :history)
      get("/statistics/transcoding", UserStatisticsController, :transcoding_statistics)
      get("/statistics/items", UserStatisticsController, :items)
      get("/statistics/items/:item_id", UserStatisticsController, :item_details)
      get("/statistics/library", UserStatisticsController, :library_stats)
      get("/statistics/unwatched", StatisticsController, :unwatched)
      get("/statistics/recommendations/me", RecommendationController, :for_me)

      get(
        "/statistics/recommendations/similar_to/:item_id",
        RecommendationController,
        :similar_to
      )

      get(
        "/statistics/recommendations/current_session/:session_id",
        RecommendationController,
        :current_session
      )

      # get("/me", UserController, :me)
      resources("/libraries", LibraryController, only: [:index, :show])
      resources("/users", UserController, only: [:index, :show])
    end
  end
end

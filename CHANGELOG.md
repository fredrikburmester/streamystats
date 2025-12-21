# Changelog

## [3.0.0](https://github.com/fredrikburmester/streamystats/compare/streamystats-v2-v2.13.0...streamystats-v2-v3.0.0) (2025-12-21)


### ⚠ BREAKING CHANGES

* This is a major version upgrade with breaking changes requiring migration from v1.x to v2.x including database schema changes, new compose file and new Docker images

### Features

* add based on statistic ([1264e4f](https://github.com/fredrikburmester/streamystats/commit/1264e4fdf371bec34e6416dd83b32b66c39fc48a))
* add basePath to next.config.mjs to make components basePath aware ([7137e11](https://github.com/fredrikburmester/streamystats/commit/7137e1108f8622db61592e5d5487e286d22faec4))
* add format and format:fix scripts for nextjs-app and update lint:fix command for safety ([f940d24](https://github.com/fredrikburmester/streamystats/commit/f940d24083863df85b6f4563a8647107667119a3))
* add horizontal scroll to similar statistics cards ([e54f907](https://github.com/fredrikburmester/streamystats/commit/e54f90723101a8deaee45c8cee2ea7427f448633))
* add image proxy API for fetching Jellyfin images with server authentication ([79eb12d](https://github.com/fredrikburmester/streamystats/commit/79eb12d7bfd2cdf1ff63c80ded4274d57046138c))
* add new dialog to show statistics about the unique users ([0337eab](https://github.com/fredrikburmester/streamystats/commit/0337eab0d8cc59139f598160196a74cd2d7125d7))
* add SKIP_STARTUP_FULL_SYNC environment variable to skip full sync on server startup ([4db4772](https://github.com/fredrikburmester/streamystats/commit/4db477228798507a87652bdc5b42ecc99cc9ca11))
* add User Activity chart with date filtering - Add horizontal bar chart showing daily active users - Implement user activity statistics in Phoenix backend - Add new API endpoint for user activity data - Create date filtering with calendar component - Add client-side data fetching via API route - Chart displays unique users per day from playback_sessions - Include date range controls with preset options - Fix tooltip spacing and layout issues ([0874dc5](https://github.com/fredrikburmester/streamystats/commit/0874dc5d2c438f036491d086dbe5ca9dcff98dba))
* add user sub-page handling and admin permission checks for security paths ([0d63d71](https://github.com/fredrikburmester/streamystats/commit/0d63d719c9dcde0303960b36f05719d4b599d53c))
* aggregate episode stats for series ([22c55d9](https://github.com/fredrikburmester/streamystats/commit/22c55d94aa1f8fdca203afcf64d6c595735fe971))
* ai tool watchtime per user and time interval ([c5a2b21](https://github.com/fredrikburmester/streamystats/commit/c5a2b21e7e01f894595b909f9ece1a13363fb8cd))
* aio image and container ([b24da5e](https://github.com/fredrikburmester/streamystats/commit/b24da5e0dfe0c5a2fc586315157e01e2cfa1a90f))
* better auth with signed token ([fec2db9](https://github.com/fredrikburmester/streamystats/commit/fec2db971a22208949e8fb3a9e5e3abd9927e0e1))
* better history filters ([37972e9](https://github.com/fredrikburmester/streamystats/commit/37972e9f06b1e889355ab9d0e8d8ee3aed75110e))
* build manual version tag ([bdf6685](https://github.com/fredrikburmester/streamystats/commit/bdf66851ade6ea80e75b2a00933da60fc9e9a37e))
* build PR images ([49f1bbe](https://github.com/fredrikburmester/streamystats/commit/49f1bbeb65f8ef869c033e5da58bd9a6a38e66b2))
* client stats ([e4db0de](https://github.com/fredrikburmester/streamystats/commit/e4db0de0894f9cc224ec400ae903d0da2aea7f28))
* dangerously merge similar items ([94e9532](https://github.com/fredrikburmester/streamystats/commit/94e9532d02b0b13fd4b967bf645c38e2c9850cec))
* **database:** add migration to fix stale jobs & auto-cleanup old records ([78e31bf](https://github.com/fredrikburmester/streamystats/commit/78e31bf6f95429d2148eafb3da003320ca07de23))
* details page ([de987e9](https://github.com/fredrikburmester/streamystats/commit/de987e9282858f799a1d245cdddd12a43b851d25))
* **docs:** aio instructions ([d5215ff](https://github.com/fredrikburmester/streamystats/commit/d5215fffe430ac22ab2fe5c718736a5f59b0b9ae))
* endpoint for deleted items ([22f4aa5](https://github.com/fredrikburmester/streamystats/commit/22f4aa589282aa8d56d9ffd35f31181515f67bea))
* enhance active sessions with detailed bitrate and transcoding info ([9cb525d](https://github.com/fredrikburmester/streamystats/commit/9cb525dcaa4fc938076111a87613b076fcb5c5a6))
* enhance ActivityLogTable with search and sorting functionality ([a4c0a45](https://github.com/fredrikburmester/streamystats/commit/a4c0a45c22c543cc2fccdf3beed8f11bb97ab4df))
* enhance ErrorBoundary with detailed error display and reporting options ([5682bfc](https://github.com/fredrikburmester/streamystats/commit/5682bfcbecd50ba858fdaf0d62d25dcf0edc11cc))
* enhance text preparation for item embeddings with structured metadata and improved people data handling ([822840d](https://github.com/fredrikburmester/streamystats/commit/822840de52812e7adfea17bc426e4d09048bbed4))
* filter out non-media types in genre stats ([1fcceb6](https://github.com/fredrikburmester/streamystats/commit/1fcceb6734250ce6948bd7bfd1923281458064a2))
* global watchtime page date picker ([1c09ffc](https://github.com/fredrikburmester/streamystats/commit/1c09ffc2ae09df8db7588e95c2e7aade02c76e0c))
* implement loading skeleton for login page and refactor component structure ([15904eb](https://github.com/fredrikburmester/streamystats/commit/15904eb4a5fc4567627cfb461120c866388abe97))
* implement security dashboard layout and components ([c17c531](https://github.com/fredrikburmester/streamystats/commit/c17c5312f7afe01202b5307fb7773e8afd25c54d))
* include history tool ([4f8a817](https://github.com/fredrikburmester/streamystats/commit/4f8a8171bd71715ce3116753a09029b3cbb3c2a4))
* index ([c4022d9](https://github.com/fredrikburmester/streamystats/commit/c4022d9e02ff43685fcb71fce60cae0cf22cc1e1))
* inf scroll for recommendations ([07b94d2](https://github.com/fredrikburmester/streamystats/commit/07b94d28657351df571f97607f6aa8f40c119cce))
* inf scrolling for season recommendations ([c566994](https://github.com/fredrikburmester/streamystats/commit/c566994412e444e5414927b3d92c97b4e7b6d024))
* item details ([eb2c788](https://github.com/fredrikburmester/streamystats/commit/eb2c788904aa23a3e0cd1c3a93fa54a704285f1c))
* **job-server:** allow setting of listening host ([c98d82a](https://github.com/fredrikburmester/streamystats/commit/c98d82a84e7bbc71566ed2f9f68a7d964ca63c1c))
* **job-server:** make cron schedules configurable via env vars ([3edef46](https://github.com/fredrikburmester/streamystats/commit/3edef46f4f164bb36c4cbefc8ab8a48bee2d0750))
* major version 2.0.0 release ([d12e3aa](https://github.com/fredrikburmester/streamystats/commit/d12e3aa5a824dbbbd5e072966f3ac538e54afded))
* make fetch() calls basePath aware ([7e1a1d0](https://github.com/fredrikburmester/streamystats/commit/7e1a1d0235792922991063e693bc41da3b3816e1))
* make middleware aware of basePath ([e6e542d](https://github.com/fredrikburmester/streamystats/commit/e6e542d3cbdc841143a1a2ec2c636250cd51a1d5))
* match and merge series ([d88ad55](https://github.com/fredrikburmester/streamystats/commit/d88ad55526b62dac46c9e3b004afe8b57c519c2a))
* merge all at once ([682908d](https://github.com/fredrikburmester/streamystats/commit/682908db95de6b7a0f5711e058427e53d8ed6809))
* merge item stats ([afa66c6](https://github.com/fredrikburmester/streamystats/commit/afa66c6102d4861627d8eb28e38c36a314b9a43a))
* more detection rules ([1d27511](https://github.com/fredrikburmester/streamystats/commit/1d27511c926f6544867e15e6f3bfc32024ce381f))
* more watch stats ([f4653fc](https://github.com/fredrikburmester/streamystats/commit/f4653fc24660e726083c27a5436f6c49f85e8046))
* move unique viewers stats to api ([2f2f416](https://github.com/fredrikburmester/streamystats/commit/2f2f4168c813aa271e5c11089f4393ae86995a14))
* **nextjs-app:** use next/image for MorphingDialogImage ([dc74fb3](https://github.com/fredrikburmester/streamystats/commit/dc74fb3521aa2a6037c0451fc9bb9f74229856d3))
* ollama support for embedding ([d3ad198](https://github.com/fredrikburmester/streamystats/commit/d3ad198b7d6a20ae96fc3306b6e25458b3d1ea9c))
* provide basePath aware fetch in utils ([09aa4ba](https://github.com/fredrikburmester/streamystats/commit/09aa4ba7cdd1e72f421119117edb086d2fdddd27))
* reconnection form on changed server base url ([776c3bc](https://github.com/fredrikburmester/streamystats/commit/776c3bc44a9196a783397ac7aa9e82eb5681a427))
* refresh button ([c4ca818](https://github.com/fredrikburmester/streamystats/commit/c4ca818e76cfb91171b24e492ce1e49181aea0bb))
* route to user security page ([a443c7a](https://github.com/fredrikburmester/streamystats/commit/a443c7a72ead741f5e4f198bf668136521dab10e))
* seasonal recomendations ([e839603](https://github.com/fredrikburmester/streamystats/commit/e8396038a0d5acb78387e1f302436406033fb7df))
* see what user you share taste with ([c123290](https://github.com/fredrikburmester/streamystats/commit/c1232905e91c4bb9fba8a8893b946134e5da3deb))
* separate audio from other ([44b2b39](https://github.com/fredrikburmester/streamystats/commit/44b2b399a51eb6ea73c947795687c8813a14293e))
* set host in compose files ([8236e3f](https://github.com/fredrikburmester/streamystats/commit/8236e3fa51f9a35d2fc2e4287daf8187b1480df7))
* settings button for full sync ([8f8eb01](https://github.com/fredrikburmester/streamystats/commit/8f8eb01752d678a5c34276da2470832c25d181ea))
* show user list on pin ([961ad67](https://github.com/fredrikburmester/streamystats/commit/961ad67753e7d24b32d3028409c4958777b4143d))
* support multiple ai servers / models for embedding ([0939e5a](https://github.com/fredrikburmester/streamystats/commit/0939e5a1a3b68514e1a790c6b1c0a14896a150bb))
* switch to next/link in SideBar and ServerSelector ([9b10318](https://github.com/fredrikburmester/streamystats/commit/9b103181d8a0448cd78df08be26020c00285ab77))
* use cache  components ([a79867f](https://github.com/fredrikburmester/streamystats/commit/a79867f8f98256b5ad13b55dcb305c8230c36050))
* use ScrollArea and ScrollBar for horizontal scrolling in SimilarSeriesStatistics ([9648625](https://github.com/fredrikburmester/streamystats/commit/9648625a78aeefd7adf94b4d702f921c57596bcd))
* use top items on user page ([448e175](https://github.com/fredrikburmester/streamystats/commit/448e175e4941c79070fe04146c57100a07da8a22))
* user fingerprinting for security and determining shared accounts ([52adda9](https://github.com/fredrikburmester/streamystats/commit/52adda93439bb01515c14a4d4a015b1fe58dd25e))
* user sync ([9610f2c](https://github.com/fredrikburmester/streamystats/commit/9610f2c4d26ce6887c26271c385f10c9523a2b3b))


### Bug Fixes

* add confirm modal ([48ee7ac](https://github.com/fredrikburmester/streamystats/commit/48ee7ac5caf93ccd82df1fc61626d12287c26a52))
* add deleted items as schedule ([cd4ac64](https://github.com/fredrikburmester/streamystats/commit/cd4ac648c14fd120cd7051456908e9fc9f83ee71))
* add force insert provider id if missing ([6c0fc43](https://github.com/fredrikburmester/streamystats/commit/6c0fc43fb2638d5df4b47d6dacc148889026f7f7))
* add indexes for better performance ([4232cf7](https://github.com/fredrikburmester/streamystats/commit/4232cf7ce9160e693474a2d37fe6d6deea268a52))
* add job-server health check condition in docker-compose ([76a97d1](https://github.com/fredrikburmester/streamystats/commit/76a97d1a8043f0752a1d5c28d983fa19028ece12))
* add map key to solve Map reused bug ([116c70f](https://github.com/fredrikburmester/streamystats/commit/116c70f990aacbd9bf7b0d98a5963f5615d82df4))
* add mapKey prop to solve Map reused bug ([ab67027](https://github.com/fredrikburmester/streamystats/commit/ab670277f1dc3fc7b11f8a64c55ceca9a3e8adcc))
* add prop map key to solve map reused bug ([54c420c](https://github.com/fredrikburmester/streamystats/commit/54c420cbbaa7ef2f131bd33b8aa7c74d7274e1b3))
* add username ([3fbf4c3](https://github.com/fredrikburmester/streamystats/commit/3fbf4c33c0dbd02fc761d5b33ce6e4a0a2260b8b))
* address review feedback about favicon varients ([988cbf1](https://github.com/fredrikburmester/streamystats/commit/988cbf1ec07ef1f5da92b549daaccba94fb43065))
* adjust margin for UserSimilarity component in user page ([f9369c8](https://github.com/fredrikburmester/streamystats/commit/f9369c893e15bdfc6562675ebc94b312946b034c))
* aio container build ([17fcc73](https://github.com/fredrikburmester/streamystats/commit/17fcc7318237f31700f6efb93ff58d6ef08e25ea))
* apply stale job cleanup fix to all cleanup functions ([f92e1d0](https://github.com/fredrikburmester/streamystats/commit/f92e1d0cac91ed834532b3be7f1725c32d2f10f6))
* auth local connect ([97e83f1](https://github.com/fredrikburmester/streamystats/commit/97e83f12736c032a1d8d36c4223fbe8c198c26ca))
* avatars in users table ([bcefacb](https://github.com/fredrikburmester/streamystats/commit/bcefacb08472f642952d77532969f62a9615ba0b))
* await params ([2acad96](https://github.com/fredrikburmester/streamystats/commit/2acad96446a91c7197a59b5a3c4e6fcb657c56bd))
* better ai library search with rag ([6835417](https://github.com/fredrikburmester/streamystats/commit/683541748b31cb7cfadfc23d735c1379c7a2bb5a))
* better auth ([af9858c](https://github.com/fredrikburmester/streamystats/commit/af9858cdf1b43549db06bbfd8442d0f60e02e1cb))
* better copy for skipped job because of server budy ([b8af5a8](https://github.com/fredrikburmester/streamystats/commit/b8af5a82f1d6caff01e225a5adf63270a80aa384))
* better design ([79e9387](https://github.com/fredrikburmester/streamystats/commit/79e938729fa0b3153d69a18468e5392a8f524820))
* better error page ([3cad946](https://github.com/fredrikburmester/streamystats/commit/3cad946cd04eaf936e24ec5c1fa7f9beabf50aed))
* better for local development ([f55a61a](https://github.com/fredrikburmester/streamystats/commit/f55a61a3301f8128e0c24577a455e01eb436ebd8))
* better logs ([4357274](https://github.com/fredrikburmester/streamystats/commit/435727465e8d676eb74d9581aa931e691b876cca))
* better match logic ([9041a72](https://github.com/fredrikburmester/streamystats/commit/9041a72b9f01e568f662efc675e4f86c1671da34))
* better matching ([e0d4ce5](https://github.com/fredrikburmester/streamystats/commit/e0d4ce5237ba4e520d134948d31a6e42246b7b54))
* better size ([d21efa1](https://github.com/fredrikburmester/streamystats/commit/d21efa1cdd382ad64bce46d73ca3d51c5248480b))
* better user admin check ([afd3d25](https://github.com/fredrikburmester/streamystats/commit/afd3d25f2c9031bbecc8835e6c20ae4392d20dbe))
* BreadcrumbLink does not handle basePath automatically ([2452709](https://github.com/fredrikburmester/streamystats/commit/2452709ef8795130763e9393cf7bfa46ae071f7b))
* breadcrumbs for watchtime page ([c3847b4](https://github.com/fredrikburmester/streamystats/commit/c3847b4c5c230f686de6c6ce89d80f1051dd21ab))
* build ([0eff520](https://github.com/fredrikburmester/streamystats/commit/0eff5205defb83d003558e08a5db6b98cc7befce))
* build action ([cd6d375](https://github.com/fredrikburmester/streamystats/commit/cd6d375c1a5608f5c1884a81a63194d62242f2ca))
* build error ([96aae63](https://github.com/fredrikburmester/streamystats/commit/96aae63573b9c827c9d12683f56a634f34ca4850))
* build error ([4bf6334](https://github.com/fredrikburmester/streamystats/commit/4bf63341a3c33e30f41463f366cea9f54ed0e69d))
* build error ([7ba7da4](https://github.com/fredrikburmester/streamystats/commit/7ba7da4d3d51158d862ae604889dd0f9831cc871))
* build error ([caee7f3](https://github.com/fredrikburmester/streamystats/commit/caee7f3d17445f8dac3e3a5e686026c562f173f4))
* build error ([9fee75a](https://github.com/fredrikburmester/streamystats/commit/9fee75a9e1fb7a8656ca75d708d9e807cdc0d8a5))
* build error ([48f0db3](https://github.com/fredrikburmester/streamystats/commit/48f0db38384a253ac980fd14ca66539552a13d98))
* build error ([9f5d2c5](https://github.com/fredrikburmester/streamystats/commit/9f5d2c5b547b3d4c68d22b713bc7f6be55bac90c))
* build error ([9beb9cb](https://github.com/fredrikburmester/streamystats/commit/9beb9cb70cc43f9327ef25bdaa2fce6c13844c8b))
* build error ([e8d6b5d](https://github.com/fredrikburmester/streamystats/commit/e8d6b5dfc1a3f166e309ecc877293b187dfb5eac))
* build errors ([f18ff49](https://github.com/fredrikburmester/streamystats/commit/f18ff49fa39db871b345af4834b7bda5dd8072ee))
* build issue ([ff0ced6](https://github.com/fredrikburmester/streamystats/commit/ff0ced6ffb7f8ceef054d4f4e107e79f2bfed0a6))
* build issue ([b5fd8ea](https://github.com/fredrikburmester/streamystats/commit/b5fd8ea1470b325f77558bcbb64ba6cb9bfbb030))
* build issues ([113ff7a](https://github.com/fredrikburmester/streamystats/commit/113ff7ae03b7bc87bccd2aa3e924a592590387d4))
* build on main push ([67664ac](https://github.com/fredrikburmester/streamystats/commit/67664ac61c0af41f77fd733219dc9553435d4f79))
* cache + remove arm from pr images ([cd49939](https://github.com/fredrikburmester/streamystats/commit/cd49939ea240b534601b17af073eb017462b40fa))
* cache data ([c4cfee6](https://github.com/fredrikburmester/streamystats/commit/c4cfee698c0a000a587bda5e080bd44f4fdcf23a))
* can't log in when using locally ([79c32c0](https://github.com/fredrikburmester/streamystats/commit/79c32c06bf428ba03a40e7803ea3cc8f828e0184))
* change to linegraph ([def8229](https://github.com/fredrikburmester/streamystats/commit/def822964969c13b58d59a8e61b47d3ec7dc14a3))
* **ci:** ensure pnpm is properly installed before use in workflow ([8649f9a](https://github.com/fredrikburmester/streamystats/commit/8649f9a6077389377c693f8625f45b57dfbd90d9))
* colors ([d7486f5](https://github.com/fredrikburmester/streamystats/commit/d7486f523e2892395697c6d238e60a97dcb3fa0b))
* consider PlayMethode DirectStream as direct ([a1f68f6](https://github.com/fredrikburmester/streamystats/commit/a1f68f6af67f3f7eaee000a636aeb46c0b4eb41b))
* copy geo files to expected location ([bbdf17d](https://github.com/fredrikburmester/streamystats/commit/bbdf17d1b32b1d33cce73d7e99944de421de912d))
* correct issue URL formatting in global error handling ([b241b67](https://github.com/fredrikburmester/streamystats/commit/b241b678a3b540a8ebc4e54797cd89fa85c5acc5))
* correct typo in SimilarStatistics component name ([9347c4f](https://github.com/fredrikburmester/streamystats/commit/9347c4fa2196738ea3b55291609b404de57cce0a))
* correctly show total count to be merged ([4ce9e06](https://github.com/fredrikburmester/streamystats/commit/4ce9e06ef03020623eabbd45a7527a12bf2cdf8a))
* deduplicate recommendations by item ID in user-specific recommendations ([8b5f573](https://github.com/fredrikburmester/streamystats/commit/8b5f573b42931d269a658f607e193948a5cfa78c))
* delete old deletedAt item in favor of new item with data ([e2e1ee0](https://github.com/fredrikburmester/streamystats/commit/e2e1ee016023945befa8f892b3466dc46a800662))
* deleted item show design ([839eadd](https://github.com/fredrikburmester/streamystats/commit/839eadd48f096311e7f0cceacadd41d47ae96b52))
* design ([63c2d73](https://github.com/fredrikburmester/streamystats/commit/63c2d733ed219149507bb7684b19c6674b6bb9a9))
* design ([d17a3a2](https://github.com/fredrikburmester/streamystats/commit/d17a3a24c0c88033deac79cdd75a5259604d43c8))
* design ([446c790](https://github.com/fredrikburmester/streamystats/commit/446c7909c991459f972a9c7a72d82de011cdf9a9))
* design and load improvements ([a2fdead](https://github.com/fredrikburmester/streamystats/commit/a2fdeadc6291a90bb21c26a4ac40abe981e9faa1))
* design for recomendatinos ([dab2bf4](https://github.com/fredrikburmester/streamystats/commit/dab2bf4849bb3a52e0ed571dbe0c510a79ef1030))
* **design:** rename chat ai and fix hover effect ([1937baa](https://github.com/fredrikburmester/streamystats/commit/1937baa3731bb6a0aeb756665af3414676d616e5))
* **design:** toltip clipping card ([734f8a9](https://github.com/fredrikburmester/streamystats/commit/734f8a96d7ff6d9caec8fc70bf3a467647e6607d))
* don't log checkpoints ([ca09b1c](https://github.com/fredrikburmester/streamystats/commit/ca09b1cf7e95b0ec590cf9612450a8da7b72db49))
* duplicate fingerprint cleanup and improvement ([f975ab1](https://github.com/fredrikburmester/streamystats/commit/f975ab180aae7979344c36bab340a90a4eec8d13))
* edge tag still used in version check ([143c8db](https://github.com/fredrikburmester/streamystats/commit/143c8dbfd48b342813489b01802ff720defd0b32))
* embedding index ([4a2d8d6](https://github.com/fredrikburmester/streamystats/commit/4a2d8d658bf4acd873cdea75744135089a42353d))
* embeding dimensions edge case ([c1d4b88](https://github.com/fredrikburmester/streamystats/commit/c1d4b88a5f5984f46e280c86ea1df3b588c41a32))
* ensure manifest resources work without logging in ([fea8383](https://github.com/fredrikburmester/streamystats/commit/fea838315c316380c1e982f11a42d54f69c20455))
* ensure web manifest is included ([56adb99](https://github.com/fredrikburmester/streamystats/commit/56adb9959cf028f7f6e2925266fbc6cbd08174c1))
* fetching outside of suspense ([b18ad26](https://github.com/fredrikburmester/streamystats/commit/b18ad26eda58d6e322ef54e11344504a96caf7a8))
* for aio container ([55ec986](https://github.com/fredrikburmester/streamystats/commit/55ec986df09ce9acbd0fe2c4906f90103bac20f6))
* hard delete the old item after merge ([d8b8608](https://github.com/fredrikburmester/streamystats/commit/d8b86088dd542cf3b73a6c6f8e24879f0a76152d))
* healthcheck in dockerfiles ([7d10ac7](https://github.com/fredrikburmester/streamystats/commit/7d10ac7ae83b03854d97e96f8353af26ab65f77b))
* hide items ([191bdab](https://github.com/fredrikburmester/streamystats/commit/191bdab4e70d759e1c9a0a4ae69e52937ec70b92))
* https://github.com/fredrikburmester/streamystats/issues/181 ([30a6e48](https://github.com/fredrikburmester/streamystats/commit/30a6e48f0537aa71d3c395a32ade469ce3816437))
* hydration warning ([a708b28](https://github.com/fredrikburmester/streamystats/commit/a708b283dc03086e1a24ebcf309c6a05e049c158))
* hydration warnings ([563440e](https://github.com/fredrikburmester/streamystats/commit/563440e5e91d9277d783f8244a2ae5b98b2bdad7))
* idempotent migration ([3465228](https://github.com/fredrikburmester/streamystats/commit/346522826c50f96f097f56c0b8edc43bb11022bc))
* ignore dist files from job server ([0577a13](https://github.com/fredrikburmester/streamystats/commit/0577a13a45695f012067679dec47cb57d72456f2))
* implement conditional startup full sync based on SKIP_STARTUP_FULL_SYNC environment variable ([4e03ea7](https://github.com/fredrikburmester/streamystats/commit/4e03ea7d36cd8c1cba3fab1956c6612671e32ef2))
* implement HEAD and add caching for manifest.json ([ad2b71e](https://github.com/fredrikburmester/streamystats/commit/ad2b71e2dcfc5fe39b6a02c70a414e1fd8dcfab3))
* improve ai streaming chat response and tool listing ([7d4bba1](https://github.com/fredrikburmester/streamystats/commit/7d4bba1f21effacda96e221345e4c2c8a0241f09))
* improve authentication response validation in server connection ([b8e7f72](https://github.com/fredrikburmester/streamystats/commit/b8e7f72983985b0e577bc3ac8068cf9248d5bf3f))
* improve mobile design ([f1409f8](https://github.com/fredrikburmester/streamystats/commit/f1409f88553865adcd1dbb2e25105281ecf706f6))
* improve sync ([519217c](https://github.com/fredrikburmester/streamystats/commit/519217c37f77ee64723755920028837a7ac4a6ed))
* improved design recomendations ([81fd292](https://github.com/fredrikburmester/streamystats/commit/81fd292f71f028b5ee15fb4a6f7970334a888bdb))
* include more fields ([866b6bc](https://github.com/fredrikburmester/streamystats/commit/866b6bc2312c3ae1537f298ebb0a055abd37cf5e))
* include provider ids in sync process ([21ccb03](https://github.com/fredrikburmester/streamystats/commit/21ccb032148d0b46be40adf885613ca65275aa35))
* incorrect transcoding logo ([78f3a21](https://github.com/fredrikburmester/streamystats/commit/78f3a21782fc9d55fb805870598b879d98194c57))
* instructions ([017dd29](https://github.com/fredrikburmester/streamystats/commit/017dd29351481e512802d06ba5e393d37ae00152))
* **jellyfin:** ensure isFolder defaults to false ([4fdeaea](https://github.com/fredrikburmester/streamystats/commit/4fdeaea22497ab86a926ca0f5b6a60186b556a32))
* jellystat importer ([01833da](https://github.com/fredrikburmester/streamystats/commit/01833dac65d5d334ee7397ac18eabe21973809e2))
* job issues ([f13c1c3](https://github.com/fredrikburmester/streamystats/commit/f13c1c3aa17ee07f03ce2af96bc7183fdbd79a9c))
* **job-server:** apply sourcery-ai suggestions wrt PORT validation ([86ef6a9](https://github.com/fredrikburmester/streamystats/commit/86ef6a9543a751f1d56f22dee83becc1c07c4ea0))
* **job-server:** do not print warning for system activites ([30a6e48](https://github.com/fredrikburmester/streamystats/commit/30a6e48f0537aa71d3c395a32ade469ce3816437))
* **job-server:** update stale jobs instead of inserting duplicates ([c6a7d6a](https://github.com/fredrikburmester/streamystats/commit/c6a7d6a55f23ad897d62935a6a29312eadf46668))
* keep tab i query param ([9955ae6](https://github.com/fredrikburmester/streamystats/commit/9955ae6e32d898e6c6f6d6083ab46603e61e34f2))
* label clarify ([8519762](https://github.com/fredrikburmester/streamystats/commit/851976292e6b83733cc590dbd19c0319914871ae))
* lint ([5e656e9](https://github.com/fredrikburmester/streamystats/commit/5e656e9ce292d8ef98a2af7b983245be13568200))
* lock bun version ([65fdeee](https://github.com/fredrikburmester/streamystats/commit/65fdeee5f5befbc53375bd8b99882cefe5019461))
* logging ([b96fabe](https://github.com/fredrikburmester/streamystats/commit/b96fabe2196cc44d9486ceaf8ad5bcb68e255de3))
* logging setup ([cc4fbd0](https://github.com/fredrikburmester/streamystats/commit/cc4fbd0abb5b1854fa48017b8d709c14df0b243e))
* logs ([c399473](https://github.com/fredrikburmester/streamystats/commit/c3994736d5672110647b76583dd5ff3c3bb23a7a))
* logs ([ae74975](https://github.com/fredrikburmester/streamystats/commit/ae7497545fa9e219ad6b85801eb542e3886bfb1b))
* mark all as resolved ([7c2ab4f](https://github.com/fredrikburmester/streamystats/commit/7c2ab4f01dad9a5f62d0ecb2410768080f92c044))
* me issue for non admin users ([dca14de](https://github.com/fredrikburmester/streamystats/commit/dca14de9a21bc38956c26d968adc160df4e14076))
* memory issue ([392b370](https://github.com/fredrikburmester/streamystats/commit/392b3709dfadc6fd7b48950014061a8821c689e4))
* migrate to jellyfin uuid instead of custom id ([74e7803](https://github.com/fredrikburmester/streamystats/commit/74e78038a0b4feed40a84bf1a8cb7e881e500c3f))
* migrate to jellyfin uuid instead of custom id ([1c454f4](https://github.com/fredrikburmester/streamystats/commit/1c454f41dd816764a1fd053045eaeceb358e5a26))
* missing geoip file ([2fca30a](https://github.com/fredrikburmester/streamystats/commit/2fca30abd79ad78fe7521337a55fa614d62b8c11))
* missing trancoding stats ([591ba7f](https://github.com/fredrikburmester/streamystats/commit/591ba7f26abc7a378097d833a118bf96aedc8849))
* more spelling ([f1efa00](https://github.com/fredrikburmester/streamystats/commit/f1efa00043768db3f16625528f6dd1acdd3fb9c9))
* movies only ([9f5f1bf](https://github.com/fredrikburmester/streamystats/commit/9f5f1bf93c85d8482c7aa519ef3cd858f22d7a12))
* **next-app:** /setup is admin only unless there are no servers configured ([dd58e4b](https://github.com/fredrikburmester/streamystats/commit/dd58e4b2eb4f37938fec2a1b9bf03a71704baa08))
* nextjs app route component for manifest.json link ([7d431b1](https://github.com/fredrikburmester/streamystats/commit/7d431b123d3b499da77c8c89096c07186b18de34))
* **nextjs-app:** correctly set body size limit ([03e59ac](https://github.com/fredrikburmester/streamystats/commit/03e59accdfb956c04c862a9d6206bef3274bc3dc))
* no frozen lockfile ([14f4668](https://github.com/fredrikburmester/streamystats/commit/14f46682b60d993f2aa94863b97ae3266a4f0b9e))
* normalize server URL by removing trailing slashes ([fe7f6f4](https://github.com/fredrikburmester/streamystats/commit/fe7f6f49da1074e22807a76b2fb6bb07c4a94601))
* ollama connection issue ([e40c11b](https://github.com/fredrikburmester/streamystats/commit/e40c11bcb32f6f825aa14b45026c4e70bd9006b4))
* only for admin ([e2b7d5b](https://github.com/fredrikburmester/streamystats/commit/e2b7d5b04fd4120d15760fc7ed0c983a6a5e592e))
* path ([a428f8b](https://github.com/fredrikburmester/streamystats/commit/a428f8b34c6149d840565fe1dc79b7626cd63a3d))
* poster lqip loading ([aec5c25](https://github.com/fredrikburmester/streamystats/commit/aec5c25867ba3fb543f8d0788b9c976bf5c3180a))
* poster quality ([f79b7c1](https://github.com/fredrikburmester/streamystats/commit/f79b7c1d0402447e28465698341c76a8235ed42a))
* prevent false deletions when Jellyfin server is down or return 0 items ([8462efb](https://github.com/fredrikburmester/streamystats/commit/8462efbf7c143963df3a2962db47ff366885a28b))
* provider name ([55aa421](https://github.com/fredrikburmester/streamystats/commit/55aa421a73b4c9df4d94cef00ac302802b0fa28b))
* refactor settings page and sidebar ([8b3a141](https://github.com/fredrikburmester/streamystats/commit/8b3a141ce4b32483f2e65e64be2c5ba0d0f68904))
* release notes ([9ea1a30](https://github.com/fredrikburmester/streamystats/commit/9ea1a30adbbe66d76a29d4932c3e171a045ab571))
* remove /users/[name] (git error that did not delete this folder) ([a0186f1](https://github.com/fredrikburmester/streamystats/commit/a0186f19f225b47ee36a2946fcfce3792cca7fed))
* remove ssr wrapper ([b3e24ef](https://github.com/fredrikburmester/streamystats/commit/b3e24ef7ec194f0b3a5c43f4a9259380ff043b9e))
* removed library causes failed sync ([260fa0b](https://github.com/fredrikburmester/streamystats/commit/260fa0b1c1dd0e6651490eabb60eefe9534149fd))
* rename database fields in job status endpoint ([cd543a2](https://github.com/fredrikburmester/streamystats/commit/cd543a22f4b5fcc73545c2c79fb2124446e07d18))
* restore or migrate items on normal sync ([1afed43](https://github.com/fredrikburmester/streamystats/commit/1afed436647b75926ae784d3758cd25e108f6c86))
* secure endpoint ([d515719](https://github.com/fredrikburmester/streamystats/commit/d515719a3bda087d1e956ce3e61f3f63ad3f99ef))
* series episode list ([64e1074](https://github.com/fredrikburmester/streamystats/commit/64e1074ba29e9b942238d2752f1054d0fa15b5d5))
* set min width and height for play and pause icon on ActiveSession card ([77be982](https://github.com/fredrikburmester/streamystats/commit/77be982f82f88235dd6bd8dd7a847a953024642d))
* showing edge label in ui ([91c624b](https://github.com/fredrikburmester/streamystats/commit/91c624babedda484271cc0c7d36902e7154673ce))
* small issues ([abb58ba](https://github.com/fredrikburmester/streamystats/commit/abb58ba0b80416948df694e63ffcd1e19c88560a))
* smaller image ([aac92dd](https://github.com/fredrikburmester/streamystats/commit/aac92dd65f9903d0edea279539bb93eb0b3422a0))
* sort by watchtime ([8aa5609](https://github.com/fredrikburmester/streamystats/commit/8aa5609a55eeeae90df67c1eb597cdd2aefc41ce))
* spelling ([df7b176](https://github.com/fredrikburmester/streamystats/commit/df7b176604f69660d8c621b0e3011ef5cf533bc9))
* spelling ([3827cfc](https://github.com/fredrikburmester/streamystats/commit/3827cfcc70547f18984f57859486731cf1947bac))
* spelling and grammer ([9a4a681](https://github.com/fredrikburmester/streamystats/commit/9a4a681034503c3d8c9d0c1d567a9bc3f2f51bbd))
* status types and docs ([ac190d8](https://github.com/fredrikburmester/streamystats/commit/ac190d8f9524301f99be2380a990dbe58012bf16))
* stuck in sync servers ([50a4020](https://github.com/fredrikburmester/streamystats/commit/50a402000f8350f23c170adc06c40128eefaeb7e))
* sync ([6fd93d6](https://github.com/fredrikburmester/streamystats/commit/6fd93d6fdd40ff937c23ee7beb9b9c6670128ac9))
* sync items on start ([56a14a9](https://github.com/fredrikburmester/streamystats/commit/56a14a98f0837393eac6c8c21b3d763fbd3e8d4f))
* timestamp issue ([51dfffd](https://github.com/fredrikburmester/streamystats/commit/51dfffd0790d81024aee83354e1ebc76bf35c2cc))
* toast fix ([b209827](https://github.com/fredrikburmester/streamystats/commit/b209827f6e8dd207ca91b95c47ec8288ee756b4a))
* type error ([fb3048d](https://github.com/fredrikburmester/streamystats/commit/fb3048d5bd6b6948bf62bcb48391b90954428efa))
* type errors ([dd88753](https://github.com/fredrikburmester/streamystats/commit/dd88753e2373f567ec547f435efb7cf1763df795))
* type issue ([1b57ca0](https://github.com/fredrikburmester/streamystats/commit/1b57ca0c65040e52de6cfdbc14b49b45eb4e565b))
* unwrap nested errors in formatError function for improved error handling ([116af7a](https://github.com/fredrikburmester/streamystats/commit/116af7a52c84838b002e62b9225e49028aa215d0))
* update Dockerfile to use Debian base image and install dependencies with apt-get ([4b11388](https://github.com/fredrikburmester/streamystats/commit/4b11388602cc52ced0e0f2fdae252fecc18a7947))
* update healthcheck to use 127.0.0.1 and remove redundant checks from docker-compose ([fd57920](https://github.com/fredrikburmester/streamystats/commit/fd5792006cb7f5f033383d3871055b3ce4331ae1))
* update job status endpoint to include 'queue' in the URL path ([f1d4a04](https://github.com/fredrikburmester/streamystats/commit/f1d4a04006d88cb3fdf78ae9102eac08767f537c))
* update next ([e4e7822](https://github.com/fredrikburmester/streamystats/commit/e4e782206714e9c491bd1472370daa40e59a6073))
* update supervisord configuration to include environment variables for database connections ([d8fcfd0](https://github.com/fredrikburmester/streamystats/commit/d8fcfd00efefe0a7f42050576fe5984d7cc3f9dd))
* update user link in ActivityLogTable to use userId directly ([9d328e0](https://github.com/fredrikburmester/streamystats/commit/9d328e016be8e62bba36b33615465a425e12f544))
* update VSCode settings to use explicit formatting and import organization actions ([24a95d5](https://github.com/fredrikburmester/streamystats/commit/24a95d5e8b0259ef6b3b7172f12fc5ff09f23dd3))
* use correct DirectPlay when importing data ([3781f1c](https://github.com/fredrikburmester/streamystats/commit/3781f1c2df76da3f889e17319d6750e4ea92a661))
* use name not userId for ActiveSessions and UserLeaderBoardTable user page linking ([30f9b70](https://github.com/fredrikburmester/streamystats/commit/30f9b70e2fcfd473ec80e53aa5a531fcd6454b65))
* use SQL[] universally and remove any restore Server ([4bdf766](https://github.com/fredrikburmester/streamystats/commit/4bdf766415b78be0c048286f7621e688b7304281))
* username ([507201b](https://github.com/fredrikburmester/streamystats/commit/507201bc2a177d2b62b08ebbaedf709fd0cbbc40))
* version badge zindex issue ([bbe6a22](https://github.com/fredrikburmester/streamystats/commit/bbe6a227085435266780353892e2ad854de2f2fb))
* width ([201f365](https://github.com/fredrikburmester/streamystats/commit/201f365222df19c3cc35c60623d7a8d8b170871a))
* wrong unreachable status in reconnect form ([711b7fe](https://github.com/fredrikburmester/streamystats/commit/711b7fe94ba2d0c0493733bbac5b7a2ce435e148))
* wrong video type in sections ([ea25a97](https://github.com/fredrikburmester/streamystats/commit/ea25a970bd1ee129bde3f36f70174accc656d694))
* zombie process ([98548f6](https://github.com/fredrikburmester/streamystats/commit/98548f63b13b42348ff21cba4beb66175cf4af94))

## [2.13.0](https://github.com/fredrikburmester/streamystats/compare/v2.12.0...v2.13.0) (2025-12-18)


### Features

* add user sub-page handling and admin permission checks for security paths ([0d63d71](https://github.com/fredrikburmester/streamystats/commit/0d63d719c9dcde0303960b36f05719d4b599d53c))
* aio image and container ([b24da5e](https://github.com/fredrikburmester/streamystats/commit/b24da5e0dfe0c5a2fc586315157e01e2cfa1a90f))
* better history filters ([37972e9](https://github.com/fredrikburmester/streamystats/commit/37972e9f06b1e889355ab9d0e8d8ee3aed75110e))
* client stats ([e4db0de](https://github.com/fredrikburmester/streamystats/commit/e4db0de0894f9cc224ec400ae903d0da2aea7f28))
* **docs:** aio instructions ([d5215ff](https://github.com/fredrikburmester/streamystats/commit/d5215fffe430ac22ab2fe5c718736a5f59b0b9ae))
* enhance ErrorBoundary with detailed error display and reporting options ([5682bfc](https://github.com/fredrikburmester/streamystats/commit/5682bfcbecd50ba858fdaf0d62d25dcf0edc11cc))
* implement security dashboard layout and components ([c17c531](https://github.com/fredrikburmester/streamystats/commit/c17c5312f7afe01202b5307fb7773e8afd25c54d))
* route to user security page ([a443c7a](https://github.com/fredrikburmester/streamystats/commit/a443c7a72ead741f5e4f198bf668136521dab10e))
* seasonal recomendations ([e839603](https://github.com/fredrikburmester/streamystats/commit/e8396038a0d5acb78387e1f302436406033fb7df))
* use cache  components ([a79867f](https://github.com/fredrikburmester/streamystats/commit/a79867f8f98256b5ad13b55dcb305c8230c36050))


### Bug Fixes

* add indexes for better performance ([4232cf7](https://github.com/fredrikburmester/streamystats/commit/4232cf7ce9160e693474a2d37fe6d6deea268a52))
* add job-server health check condition in docker-compose ([76a97d1](https://github.com/fredrikburmester/streamystats/commit/76a97d1a8043f0752a1d5c28d983fa19028ece12))
* add map key to solve Map reused bug ([116c70f](https://github.com/fredrikburmester/streamystats/commit/116c70f990aacbd9bf7b0d98a5963f5615d82df4))
* add mapKey prop to solve Map reused bug ([ab67027](https://github.com/fredrikburmester/streamystats/commit/ab670277f1dc3fc7b11f8a64c55ceca9a3e8adcc))
* add prop map key to solve map reused bug ([54c420c](https://github.com/fredrikburmester/streamystats/commit/54c420cbbaa7ef2f131bd33b8aa7c74d7274e1b3))
* better error page ([3cad946](https://github.com/fredrikburmester/streamystats/commit/3cad946cd04eaf936e24ec5c1fa7f9beabf50aed))
* build error ([96aae63](https://github.com/fredrikburmester/streamystats/commit/96aae63573b9c827c9d12683f56a634f34ca4850))
* correct issue URL formatting in global error handling ([b241b67](https://github.com/fredrikburmester/streamystats/commit/b241b678a3b540a8ebc4e54797cd89fa85c5acc5))
* fetching outside of suspense ([b18ad26](https://github.com/fredrikburmester/streamystats/commit/b18ad26eda58d6e322ef54e11344504a96caf7a8))
* healthcheck in dockerfiles ([7d10ac7](https://github.com/fredrikburmester/streamystats/commit/7d10ac7ae83b03854d97e96f8353af26ab65f77b))
* keep tab i query param ([9955ae6](https://github.com/fredrikburmester/streamystats/commit/9955ae6e32d898e6c6f6d6083ab46603e61e34f2))
* lint ([5e656e9](https://github.com/fredrikburmester/streamystats/commit/5e656e9ce292d8ef98a2af7b983245be13568200))
* missing geoip file ([2fca30a](https://github.com/fredrikburmester/streamystats/commit/2fca30abd79ad78fe7521337a55fa614d62b8c11))
* update Dockerfile to use Debian base image and install dependencies with apt-get ([4b11388](https://github.com/fredrikburmester/streamystats/commit/4b11388602cc52ced0e0f2fdae252fecc18a7947))

## [2.12.0](https://github.com/fredrikburmester/streamystats/compare/v2.11.0...v2.12.0) (2025-12-17)


### Features

* more detection rules ([1d27511](https://github.com/fredrikburmester/streamystats/commit/1d27511c926f6544867e15e6f3bfc32024ce381f))
* refresh button ([c4ca818](https://github.com/fredrikburmester/streamystats/commit/c4ca818e76cfb91171b24e492ce1e49181aea0bb))
* show user list on pin ([961ad67](https://github.com/fredrikburmester/streamystats/commit/961ad67753e7d24b32d3028409c4958777b4143d))
* user fingerprinting for security and determining shared accounts ([52adda9](https://github.com/fredrikburmester/streamystats/commit/52adda93439bb01515c14a4d4a015b1fe58dd25e))


### Bug Fixes

* build error ([4bf6334](https://github.com/fredrikburmester/streamystats/commit/4bf63341a3c33e30f41463f366cea9f54ed0e69d))
* improve ai streaming chat response and tool listing ([7d4bba1](https://github.com/fredrikburmester/streamystats/commit/7d4bba1f21effacda96e221345e4c2c8a0241f09))
* mark all as resolved ([7c2ab4f](https://github.com/fredrikburmester/streamystats/commit/7c2ab4f01dad9a5f62d0ecb2410768080f92c044))
* only for admin ([e2b7d5b](https://github.com/fredrikburmester/streamystats/commit/e2b7d5b04fd4120d15760fc7ed0c983a6a5e592e))
* status types and docs ([ac190d8](https://github.com/fredrikburmester/streamystats/commit/ac190d8f9524301f99be2380a990dbe58012bf16))

## [2.11.0](https://github.com/fredrikburmester/streamystats/compare/v2.10.0...v2.11.0) (2025-12-15)


### Features

* global watchtime page date picker ([1c09ffc](https://github.com/fredrikburmester/streamystats/commit/1c09ffc2ae09df8db7588e95c2e7aade02c76e0c))
* more watch stats ([f4653fc](https://github.com/fredrikburmester/streamystats/commit/f4653fc24660e726083c27a5436f6c49f85e8046))


### Bug Fixes

* breadcrumbs for watchtime page ([c3847b4](https://github.com/fredrikburmester/streamystats/commit/c3847b4c5c230f686de6c6ce89d80f1051dd21ab))
* change to linegraph ([def8229](https://github.com/fredrikburmester/streamystats/commit/def822964969c13b58d59a8e61b47d3ec7dc14a3))
* update healthcheck to use 127.0.0.1 and remove redundant checks from docker-compose ([fd57920](https://github.com/fredrikburmester/streamystats/commit/fd5792006cb7f5f033383d3871055b3ce4331ae1))
* version badge zindex issue ([bbe6a22](https://github.com/fredrikburmester/streamystats/commit/bbe6a227085435266780353892e2ad854de2f2fb))

## [2.10.0](https://github.com/fredrikburmester/streamystats/compare/v2.9.0...v2.10.0) (2025-12-15)


### Features

* see what user you share taste with ([c123290](https://github.com/fredrikburmester/streamystats/commit/c1232905e91c4bb9fba8a8893b946134e5da3deb))
* use top items on user page ([448e175](https://github.com/fredrikburmester/streamystats/commit/448e175e4941c79070fe04146c57100a07da8a22))


### Bug Fixes

* build error ([7ba7da4](https://github.com/fredrikburmester/streamystats/commit/7ba7da4d3d51158d862ae604889dd0f9831cc871))
* build error ([caee7f3](https://github.com/fredrikburmester/streamystats/commit/caee7f3d17445f8dac3e3a5e686026c562f173f4))
* build issue ([b5fd8ea](https://github.com/fredrikburmester/streamystats/commit/b5fd8ea1470b325f77558bcbb64ba6cb9bfbb030))
* cache + remove arm from pr images ([cd49939](https://github.com/fredrikburmester/streamystats/commit/cd49939ea240b534601b17af073eb017462b40fa))
* cache data ([c4cfee6](https://github.com/fredrikburmester/streamystats/commit/c4cfee698c0a000a587bda5e080bd44f4fdcf23a))
* **design:** rename chat ai and fix hover effect ([1937baa](https://github.com/fredrikburmester/streamystats/commit/1937baa3731bb6a0aeb756665af3414676d616e5))
* **design:** toltip clipping card ([734f8a9](https://github.com/fredrikburmester/streamystats/commit/734f8a96d7ff6d9caec8fc70bf3a467647e6607d))
* don't log checkpoints ([ca09b1c](https://github.com/fredrikburmester/streamystats/commit/ca09b1cf7e95b0ec590cf9612450a8da7b72db49))
* lock bun version ([65fdeee](https://github.com/fredrikburmester/streamystats/commit/65fdeee5f5befbc53375bd8b99882cefe5019461))
* smaller image ([aac92dd](https://github.com/fredrikburmester/streamystats/commit/aac92dd65f9903d0edea279539bb93eb0b3422a0))

## [2.9.0](https://github.com/fredrikburmester/streamystats/compare/v2.8.0...v2.9.0) (2025-12-14)


### Features

* ai tool watchtime per user and time interval ([c5a2b21](https://github.com/fredrikburmester/streamystats/commit/c5a2b21e7e01f894595b909f9ece1a13363fb8cd))
* dangerously merge similar items ([94e9532](https://github.com/fredrikburmester/streamystats/commit/94e9532d02b0b13fd4b967bf645c38e2c9850cec))
* include history tool ([4f8a817](https://github.com/fredrikburmester/streamystats/commit/4f8a8171bd71715ce3116753a09029b3cbb3c2a4))
* match and merge series ([d88ad55](https://github.com/fredrikburmester/streamystats/commit/d88ad55526b62dac46c9e3b004afe8b57c519c2a))
* merge all at once ([682908d](https://github.com/fredrikburmester/streamystats/commit/682908db95de6b7a0f5711e058427e53d8ed6809))
* merge item stats ([afa66c6](https://github.com/fredrikburmester/streamystats/commit/afa66c6102d4861627d8eb28e38c36a314b9a43a))


### Bug Fixes

* add confirm modal ([48ee7ac](https://github.com/fredrikburmester/streamystats/commit/48ee7ac5caf93ccd82df1fc61626d12287c26a52))
* add force insert provider id if missing ([6c0fc43](https://github.com/fredrikburmester/streamystats/commit/6c0fc43fb2638d5df4b47d6dacc148889026f7f7))
* better copy for skipped job because of server budy ([b8af5a8](https://github.com/fredrikburmester/streamystats/commit/b8af5a82f1d6caff01e225a5adf63270a80aa384))
* better design ([79e9387](https://github.com/fredrikburmester/streamystats/commit/79e938729fa0b3153d69a18468e5392a8f524820))
* better match logic ([9041a72](https://github.com/fredrikburmester/streamystats/commit/9041a72b9f01e568f662efc675e4f86c1671da34))
* better matching ([e0d4ce5](https://github.com/fredrikburmester/streamystats/commit/e0d4ce5237ba4e520d134948d31a6e42246b7b54))
* build error ([9fee75a](https://github.com/fredrikburmester/streamystats/commit/9fee75a9e1fb7a8656ca75d708d9e807cdc0d8a5))
* correctly show total count to be merged ([4ce9e06](https://github.com/fredrikburmester/streamystats/commit/4ce9e06ef03020623eabbd45a7527a12bf2cdf8a))
* delete old deletedAt item in favor of new item with data ([e2e1ee0](https://github.com/fredrikburmester/streamystats/commit/e2e1ee016023945befa8f892b3466dc46a800662))
* design ([63c2d73](https://github.com/fredrikburmester/streamystats/commit/63c2d733ed219149507bb7684b19c6674b6bb9a9))
* design and load improvements ([a2fdead](https://github.com/fredrikburmester/streamystats/commit/a2fdeadc6291a90bb21c26a4ac40abe981e9faa1))
* hard delete the old item after merge ([d8b8608](https://github.com/fredrikburmester/streamystats/commit/d8b86088dd542cf3b73a6c6f8e24879f0a76152d))
* include more fields ([866b6bc](https://github.com/fredrikburmester/streamystats/commit/866b6bc2312c3ae1537f298ebb0a055abd37cf5e))
* include provider ids in sync process ([21ccb03](https://github.com/fredrikburmester/streamystats/commit/21ccb032148d0b46be40adf885613ca65275aa35))
* movies only ([9f5f1bf](https://github.com/fredrikburmester/streamystats/commit/9f5f1bf93c85d8482c7aa519ef3cd858f22d7a12))
* poster lqip loading ([aec5c25](https://github.com/fredrikburmester/streamystats/commit/aec5c25867ba3fb543f8d0788b9c976bf5c3180a))
* series episode list ([64e1074](https://github.com/fredrikburmester/streamystats/commit/64e1074ba29e9b942238d2752f1054d0fa15b5d5))
* sync items on start ([56a14a9](https://github.com/fredrikburmester/streamystats/commit/56a14a98f0837393eac6c8c21b3d763fbd3e8d4f))

## [2.8.0](https://github.com/fredrikburmester/streamystats/compare/v2.7.0...v2.8.0) (2025-12-13)


### Features

* separate audio from other ([44b2b39](https://github.com/fredrikburmester/streamystats/commit/44b2b399a51eb6ea73c947795687c8813a14293e))


### Bug Fixes

* design for recomendatinos ([dab2bf4](https://github.com/fredrikburmester/streamystats/commit/dab2bf4849bb3a52e0ed571dbe0c510a79ef1030))
* improved design recomendations ([81fd292](https://github.com/fredrikburmester/streamystats/commit/81fd292f71f028b5ee15fb4a6f7970334a888bdb))
* prevent false deletions when Jellyfin server is down or return 0 items ([8462efb](https://github.com/fredrikburmester/streamystats/commit/8462efbf7c143963df3a2962db47ff366885a28b))

## [2.7.0](https://github.com/fredrikburmester/streamystats/compare/v2.6.1...v2.7.0) (2025-12-13)


### Features

* endpoint for deleted items ([22f4aa5](https://github.com/fredrikburmester/streamystats/commit/22f4aa589282aa8d56d9ffd35f31181515f67bea))


### Bug Fixes

* add deleted items as schedule ([cd4ac64](https://github.com/fredrikburmester/streamystats/commit/cd4ac648c14fd120cd7051456908e9fc9f83ee71))
* better ai library search with rag ([6835417](https://github.com/fredrikburmester/streamystats/commit/683541748b31cb7cfadfc23d735c1379c7a2bb5a))
* build action ([cd6d375](https://github.com/fredrikburmester/streamystats/commit/cd6d375c1a5608f5c1884a81a63194d62242f2ca))
* deleted item show design ([839eadd](https://github.com/fredrikburmester/streamystats/commit/839eadd48f096311e7f0cceacadd41d47ae96b52))
* design ([d17a3a2](https://github.com/fredrikburmester/streamystats/commit/d17a3a24c0c88033deac79cdd75a5259604d43c8))
* embeding dimensions edge case ([c1d4b88](https://github.com/fredrikburmester/streamystats/commit/c1d4b88a5f5984f46e280c86ea1df3b588c41a32))
* hydration warning ([a708b28](https://github.com/fredrikburmester/streamystats/commit/a708b283dc03086e1a24ebcf309c6a05e049c158))
* hydration warnings ([563440e](https://github.com/fredrikburmester/streamystats/commit/563440e5e91d9277d783f8244a2ae5b98b2bdad7))
* logs ([c399473](https://github.com/fredrikburmester/streamystats/commit/c3994736d5672110647b76583dd5ff3c3bb23a7a))
* logs ([ae74975](https://github.com/fredrikburmester/streamystats/commit/ae7497545fa9e219ad6b85801eb542e3886bfb1b))
* memory issue ([392b370](https://github.com/fredrikburmester/streamystats/commit/392b3709dfadc6fd7b48950014061a8821c689e4))
* path ([a428f8b](https://github.com/fredrikburmester/streamystats/commit/a428f8b34c6149d840565fe1dc79b7626cd63a3d))
* remove ssr wrapper ([b3e24ef](https://github.com/fredrikburmester/streamystats/commit/b3e24ef7ec194f0b3a5c43f4a9259380ff043b9e))
* restore or migrate items on normal sync ([1afed43](https://github.com/fredrikburmester/streamystats/commit/1afed436647b75926ae784d3758cd25e108f6c86))

## [2.6.1](https://github.com/fredrikburmester/streamystats/compare/v2.6.0...v2.6.1) (2025-12-12)


### Bug Fixes

* auth local connect ([97e83f1](https://github.com/fredrikburmester/streamystats/commit/97e83f12736c032a1d8d36c4223fbe8c198c26ca))
* better logs ([4357274](https://github.com/fredrikburmester/streamystats/commit/435727465e8d676eb74d9581aa931e691b876cca))
* better size ([d21efa1](https://github.com/fredrikburmester/streamystats/commit/d21efa1cdd382ad64bce46d73ca3d51c5248480b))
* build ([0eff520](https://github.com/fredrikburmester/streamystats/commit/0eff5205defb83d003558e08a5db6b98cc7befce))
* can't log in when using locally ([79c32c0](https://github.com/fredrikburmester/streamystats/commit/79c32c06bf428ba03a40e7803ea3cc8f828e0184))
* colors ([d7486f5](https://github.com/fredrikburmester/streamystats/commit/d7486f523e2892395697c6d238e60a97dcb3fa0b))
* label clarify ([8519762](https://github.com/fredrikburmester/streamystats/commit/851976292e6b83733cc590dbd19c0319914871ae))
* logging setup ([cc4fbd0](https://github.com/fredrikburmester/streamystats/commit/cc4fbd0abb5b1854fa48017b8d709c14df0b243e))
* stuck in sync servers ([50a4020](https://github.com/fredrikburmester/streamystats/commit/50a402000f8350f23c170adc06c40128eefaeb7e))
* wrong unreachable status in reconnect form ([711b7fe](https://github.com/fredrikburmester/streamystats/commit/711b7fe94ba2d0c0493733bbac5b7a2ce435e148))

## [2.6.0](https://github.com/fredrikburmester/streamystats/compare/v2.5.0...v2.6.0) (2025-12-11)


### Features

* add new dialog to show statistics about the unique users ([0337eab](https://github.com/fredrikburmester/streamystats/commit/0337eab0d8cc59139f598160196a74cd2d7125d7))
* better auth with signed token ([fec2db9](https://github.com/fredrikburmester/streamystats/commit/fec2db971a22208949e8fb3a9e5e3abd9927e0e1))
* **database:** add migration to fix stale jobs & auto-cleanup old records ([78e31bf](https://github.com/fredrikburmester/streamystats/commit/78e31bf6f95429d2148eafb3da003320ca07de23))
* index ([c4022d9](https://github.com/fredrikburmester/streamystats/commit/c4022d9e02ff43685fcb71fce60cae0cf22cc1e1))
* move unique viewers stats to api ([2f2f416](https://github.com/fredrikburmester/streamystats/commit/2f2f4168c813aa271e5c11089f4393ae86995a14))
* reconnection form on changed server base url ([776c3bc](https://github.com/fredrikburmester/streamystats/commit/776c3bc44a9196a783397ac7aa9e82eb5681a427))
* support multiple ai servers / models for embedding ([0939e5a](https://github.com/fredrikburmester/streamystats/commit/0939e5a1a3b68514e1a790c6b1c0a14896a150bb))


### Bug Fixes

* add username ([3fbf4c3](https://github.com/fredrikburmester/streamystats/commit/3fbf4c33c0dbd02fc761d5b33ce6e4a0a2260b8b))
* apply stale job cleanup fix to all cleanup functions ([f92e1d0](https://github.com/fredrikburmester/streamystats/commit/f92e1d0cac91ed834532b3be7f1725c32d2f10f6))
* build issues ([113ff7a](https://github.com/fredrikburmester/streamystats/commit/113ff7ae03b7bc87bccd2aa3e924a592590387d4))
* embedding index ([4a2d8d6](https://github.com/fredrikburmester/streamystats/commit/4a2d8d658bf4acd873cdea75744135089a42353d))
* improve authentication response validation in server connection ([b8e7f72](https://github.com/fredrikburmester/streamystats/commit/b8e7f72983985b0e577bc3ac8068cf9248d5bf3f))
* job issues ([f13c1c3](https://github.com/fredrikburmester/streamystats/commit/f13c1c3aa17ee07f03ce2af96bc7183fdbd79a9c))
* **job-server:** update stale jobs instead of inserting duplicates ([c6a7d6a](https://github.com/fredrikburmester/streamystats/commit/c6a7d6a55f23ad897d62935a6a29312eadf46668))
* logging ([b96fabe](https://github.com/fredrikburmester/streamystats/commit/b96fabe2196cc44d9486ceaf8ad5bcb68e255de3))
* me issue for non admin users ([dca14de](https://github.com/fredrikburmester/streamystats/commit/dca14de9a21bc38956c26d968adc160df4e14076))
* normalize server URL by removing trailing slashes ([fe7f6f4](https://github.com/fredrikburmester/streamystats/commit/fe7f6f49da1074e22807a76b2fb6bb07c4a94601))
* provider name ([55aa421](https://github.com/fredrikburmester/streamystats/commit/55aa421a73b4c9df4d94cef00ac302802b0fa28b))
* secure endpoint ([d515719](https://github.com/fredrikburmester/streamystats/commit/d515719a3bda087d1e956ce3e61f3f63ad3f99ef))
* timestamp issue ([51dfffd](https://github.com/fredrikburmester/streamystats/commit/51dfffd0790d81024aee83354e1ebc76bf35c2cc))
* toast fix ([b209827](https://github.com/fredrikburmester/streamystats/commit/b209827f6e8dd207ca91b95c47ec8288ee756b4a))
* type issue ([1b57ca0](https://github.com/fredrikburmester/streamystats/commit/1b57ca0c65040e52de6cfdbc14b49b45eb4e565b))
* username ([507201b](https://github.com/fredrikburmester/streamystats/commit/507201bc2a177d2b62b08ebbaedf709fd0cbbc40))

## [2.5.0](https://github.com/fredrikburmester/streamystats/compare/v2.4.0...v2.5.0) (2025-10-24)


### Features

* add basePath to next.config.mjs to make components basePath aware ([7137e11](https://github.com/fredrikburmester/streamystats/commit/7137e1108f8622db61592e5d5487e286d22faec4))
* enhance ActivityLogTable with search and sorting functionality ([a4c0a45](https://github.com/fredrikburmester/streamystats/commit/a4c0a45c22c543cc2fccdf3beed8f11bb97ab4df))
* make fetch() calls basePath aware ([7e1a1d0](https://github.com/fredrikburmester/streamystats/commit/7e1a1d0235792922991063e693bc41da3b3816e1))
* make middleware aware of basePath ([e6e542d](https://github.com/fredrikburmester/streamystats/commit/e6e542d3cbdc841143a1a2ec2c636250cd51a1d5))
* provide basePath aware fetch in utils ([09aa4ba](https://github.com/fredrikburmester/streamystats/commit/09aa4ba7cdd1e72f421119117edb086d2fdddd27))
* settings button for full sync ([8f8eb01](https://github.com/fredrikburmester/streamystats/commit/8f8eb01752d678a5c34276da2470832c25d181ea))
* switch to next/link in SideBar and ServerSelector ([9b10318](https://github.com/fredrikburmester/streamystats/commit/9b103181d8a0448cd78df08be26020c00285ab77))


### Bug Fixes

* address review feedback about favicon varients ([988cbf1](https://github.com/fredrikburmester/streamystats/commit/988cbf1ec07ef1f5da92b549daaccba94fb43065))
* better for local development ([f55a61a](https://github.com/fredrikburmester/streamystats/commit/f55a61a3301f8128e0c24577a455e01eb436ebd8))
* BreadcrumbLink does not handle basePath automatically ([2452709](https://github.com/fredrikburmester/streamystats/commit/2452709ef8795130763e9393cf7bfa46ae071f7b))
* consider PlayMethode DirectStream as direct ([a1f68f6](https://github.com/fredrikburmester/streamystats/commit/a1f68f6af67f3f7eaee000a636aeb46c0b4eb41b))
* ensure manifest resources work without logging in ([fea8383](https://github.com/fredrikburmester/streamystats/commit/fea838315c316380c1e982f11a42d54f69c20455))
* ensure web manifest is included ([56adb99](https://github.com/fredrikburmester/streamystats/commit/56adb9959cf028f7f6e2925266fbc6cbd08174c1))
* implement HEAD and add caching for manifest.json ([ad2b71e](https://github.com/fredrikburmester/streamystats/commit/ad2b71e2dcfc5fe39b6a02c70a414e1fd8dcfab3))
* missing trancoding stats ([591ba7f](https://github.com/fredrikburmester/streamystats/commit/591ba7f26abc7a378097d833a118bf96aedc8849))
* more spelling ([f1efa00](https://github.com/fredrikburmester/streamystats/commit/f1efa00043768db3f16625528f6dd1acdd3fb9c9))
* nextjs app route component for manifest.json link ([7d431b1](https://github.com/fredrikburmester/streamystats/commit/7d431b123d3b499da77c8c89096c07186b18de34))
* remove /users/[name] (git error that did not delete this folder) ([a0186f1](https://github.com/fredrikburmester/streamystats/commit/a0186f19f225b47ee36a2946fcfce3792cca7fed))
* set min width and height for play and pause icon on ActiveSession card ([77be982](https://github.com/fredrikburmester/streamystats/commit/77be982f82f88235dd6bd8dd7a847a953024642d))
* sort by watchtime ([8aa5609](https://github.com/fredrikburmester/streamystats/commit/8aa5609a55eeeae90df67c1eb597cdd2aefc41ce))
* spelling ([df7b176](https://github.com/fredrikburmester/streamystats/commit/df7b176604f69660d8c621b0e3011ef5cf533bc9))
* spelling ([3827cfc](https://github.com/fredrikburmester/streamystats/commit/3827cfcc70547f18984f57859486731cf1947bac))
* spelling and grammer ([9a4a681](https://github.com/fredrikburmester/streamystats/commit/9a4a681034503c3d8c9d0c1d567a9bc3f2f51bbd))
* type errors ([dd88753](https://github.com/fredrikburmester/streamystats/commit/dd88753e2373f567ec547f435efb7cf1763df795))
* update user link in ActivityLogTable to use userId directly ([9d328e0](https://github.com/fredrikburmester/streamystats/commit/9d328e016be8e62bba36b33615465a425e12f544))
* use name not userId for ActiveSessions and UserLeaderBoardTable user page linking ([30f9b70](https://github.com/fredrikburmester/streamystats/commit/30f9b70e2fcfd473ec80e53aa5a531fcd6454b65))

## [2.4.0](https://github.com/fredrikburmester/streamystats/compare/v2.3.0...v2.4.0) (2025-07-21)


### Features

* build PR images ([49f1bbe](https://github.com/fredrikburmester/streamystats/commit/49f1bbeb65f8ef869c033e5da58bd9a6a38e66b2))


### Bug Fixes

* avatars in users table ([bcefacb](https://github.com/fredrikburmester/streamystats/commit/bcefacb08472f642952d77532969f62a9615ba0b))
* build error ([48f0db3](https://github.com/fredrikburmester/streamystats/commit/48f0db38384a253ac980fd14ca66539552a13d98))
* build error ([9f5d2c5](https://github.com/fredrikburmester/streamystats/commit/9f5d2c5b547b3d4c68d22b713bc7f6be55bac90c))
* https://github.com/fredrikburmester/streamystats/issues/181 ([30a6e48](https://github.com/fredrikburmester/streamystats/commit/30a6e48f0537aa71d3c395a32ade469ce3816437))
* ignore dist files from job server ([0577a13](https://github.com/fredrikburmester/streamystats/commit/0577a13a45695f012067679dec47cb57d72456f2))
* **job-server:** do not print warning for system activites ([30a6e48](https://github.com/fredrikburmester/streamystats/commit/30a6e48f0537aa71d3c395a32ade469ce3816437))
* **next-app:** /setup is admin only unless there are no servers configured ([dd58e4b](https://github.com/fredrikburmester/streamystats/commit/dd58e4b2eb4f37938fec2a1b9bf03a71704baa08))

## [2.3.0](https://github.com/fredrikburmester/streamystats/compare/v2.2.0...v2.3.0) (2025-07-20)


### Features

* build manual version tag ([bdf6685](https://github.com/fredrikburmester/streamystats/commit/bdf66851ade6ea80e75b2a00933da60fc9e9a37e))
* details page ([de987e9](https://github.com/fredrikburmester/streamystats/commit/de987e9282858f799a1d245cdddd12a43b851d25))
* filter out non-media types in genre stats ([1fcceb6](https://github.com/fredrikburmester/streamystats/commit/1fcceb6734250ce6948bd7bfd1923281458064a2))
* set host in compose files ([8236e3f](https://github.com/fredrikburmester/streamystats/commit/8236e3fa51f9a35d2fc2e4287daf8187b1480df7))


### Bug Fixes

* build error ([9beb9cb](https://github.com/fredrikburmester/streamystats/commit/9beb9cb70cc43f9327ef25bdaa2fce6c13844c8b))
* build error ([e8d6b5d](https://github.com/fredrikburmester/streamystats/commit/e8d6b5dfc1a3f166e309ecc877293b187dfb5eac))
* build errors ([f18ff49](https://github.com/fredrikburmester/streamystats/commit/f18ff49fa39db871b345af4834b7bda5dd8072ee))
* no frozen lockfile ([14f4668](https://github.com/fredrikburmester/streamystats/commit/14f46682b60d993f2aa94863b97ae3266a4f0b9e))
* showing edge label in ui ([91c624b](https://github.com/fredrikburmester/streamystats/commit/91c624babedda484271cc0c7d36902e7154673ce))
* update next ([e4e7822](https://github.com/fredrikburmester/streamystats/commit/e4e782206714e9c491bd1472370daa40e59a6073))

## [2.2.0](https://github.com/fredrikburmester/streamystats/compare/v2.1.1...v2.2.0) (2025-07-18)


### Features

* aggregate episode stats for series ([22c55d9](https://github.com/fredrikburmester/streamystats/commit/22c55d94aa1f8fdca203afcf64d6c595735fe971))

## [2.1.1](https://github.com/fredrikburmester/streamystats/compare/v2.1.0...v2.1.1) (2025-07-18)


### Bug Fixes

* await params ([2acad96](https://github.com/fredrikburmester/streamystats/commit/2acad96446a91c7197a59b5a3c4e6fcb657c56bd))
* better auth ([af9858c](https://github.com/fredrikburmester/streamystats/commit/af9858cdf1b43549db06bbfd8442d0f60e02e1cb))
* build on main push ([67664ac](https://github.com/fredrikburmester/streamystats/commit/67664ac61c0af41f77fd733219dc9553435d4f79))
* release notes ([9ea1a30](https://github.com/fredrikburmester/streamystats/commit/9ea1a30adbbe66d76a29d4932c3e171a045ab571))

## [2.1.0](https://github.com/fredrikburmester/streamystats/compare/v2.0.0...v2.1.0) (2025-07-18)


### Features

* add horizontal scroll to similar statistics cards ([e54f907](https://github.com/fredrikburmester/streamystats/commit/e54f90723101a8deaee45c8cee2ea7427f448633))
* item details ([eb2c788](https://github.com/fredrikburmester/streamystats/commit/eb2c788904aa23a3e0cd1c3a93fa54a704285f1c))
* **job-server:** allow setting of listening host ([c98d82a](https://github.com/fredrikburmester/streamystats/commit/c98d82a84e7bbc71566ed2f9f68a7d964ca63c1c))
* **nextjs-app:** use next/image for MorphingDialogImage ([dc74fb3](https://github.com/fredrikburmester/streamystats/commit/dc74fb3521aa2a6037c0451fc9bb9f74229856d3))
* use ScrollArea and ScrollBar for horizontal scrolling in SimilarSeriesStatistics ([9648625](https://github.com/fredrikburmester/streamystats/commit/9648625a78aeefd7adf94b4d702f921c57596bcd))
* user sync ([9610f2c](https://github.com/fredrikburmester/streamystats/commit/9610f2c4d26ce6887c26271c385f10c9523a2b3b))


### Bug Fixes

* better user admin check ([afd3d25](https://github.com/fredrikburmester/streamystats/commit/afd3d25f2c9031bbecc8835e6c20ae4392d20dbe))
* **ci:** ensure pnpm is properly installed before use in workflow ([8649f9a](https://github.com/fredrikburmester/streamystats/commit/8649f9a6077389377c693f8625f45b57dfbd90d9))
* correct typo in SimilarStatistics component name ([9347c4f](https://github.com/fredrikburmester/streamystats/commit/9347c4fa2196738ea3b55291609b404de57cce0a))
* edge tag still used in version check ([143c8db](https://github.com/fredrikburmester/streamystats/commit/143c8dbfd48b342813489b01802ff720defd0b32))
* **job-server:** apply sourcery-ai suggestions wrt PORT validation ([86ef6a9](https://github.com/fredrikburmester/streamystats/commit/86ef6a9543a751f1d56f22dee83becc1c07c4ea0))
* **nextjs-app:** correctly set body size limit ([03e59ac](https://github.com/fredrikburmester/streamystats/commit/03e59accdfb956c04c862a9d6206bef3274bc3dc))
* removed library causes failed sync ([260fa0b](https://github.com/fredrikburmester/streamystats/commit/260fa0b1c1dd0e6651490eabb60eefe9534149fd))

## [2.0.0](https://github.com/fredrikburmester/streamystats/compare/v1.8.0...v2.0.0) (2025-06-07)


### ⚠ BREAKING CHANGES

* This is a major version upgrade with breaking changes requiring migration from v1.x to v2.x including database schema changes, new compose file and new Docker images

### Features

* major version 2.0.0 release ([d12e3aa](https://github.com/fredrikburmester/streamystats/commit/d12e3aa5a824dbbbd5e072966f3ac538e54afded))


### Bug Fixes

* instructions ([017dd29](https://github.com/fredrikburmester/streamystats/commit/017dd29351481e512802d06ba5e393d37ae00152))

## [1.7.3](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.7.2...streamystat-v1.7.3) (2025-05-21)


### Bug Fixes

* incorrect transcoding logo ([78f3a21](https://github.com/fredrikburmester/streamystats/commit/78f3a21782fc9d55fb805870598b879d98194c57))
* incorrect transcoding logo when imported data from plugin ([4ddc567](https://github.com/fredrikburmester/streamystats/commit/4ddc56757e84d338ce09b924248df74dfd32aa9d))
* refactor dashboard ([fd5b55a](https://github.com/fredrikburmester/streamystats/commit/fd5b55a71107f5443b06701d45cd2e2982120b33))
* refactor settings page and sidebar ([ef1d080](https://github.com/fredrikburmester/streamystats/commit/ef1d080cd840b51a86f1014ae73835f791f163c3))
* refactor settings page and sidebar ([8b3a141](https://github.com/fredrikburmester/streamystats/commit/8b3a141ce4b32483f2e65e64be2c5ba0d0f68904))

## [1.7.2](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.7.1...streamystat-v1.7.2) (2025-05-19)


### Bug Fixes

* update dismiss saved not working ([2654155](https://github.com/fredrikburmester/streamystats/commit/2654155885f893c6da10e5b1ab252fd562f27de4))

## [1.7.1](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.7.0...streamystat-v1.7.1) (2025-05-19)


### Bug Fixes

* auto start embedding ([646b63d](https://github.com/fredrikburmester/streamystats/commit/646b63de30f94b5e6d41954de170cc6c3a80e8fe))
* auto start embedding ([0284f35](https://github.com/fredrikburmester/streamystats/commit/0284f35e349f1490f4d77bc22339b6cbc29385aa))
* remove logs [skip ci] ([e741703](https://github.com/fredrikburmester/streamystats/commit/e74170385df8e110136b42911794168621e51c3e))
* save dismissed new version hash - don't show again ([27e216b](https://github.com/fredrikburmester/streamystats/commit/27e216bf112f752f0501bf62a767321dfff7b968))
* save dismissed new version hash - don't show again ([1b3574a](https://github.com/fredrikburmester/streamystats/commit/1b3574a882d5ca6f65df024f280576290f899d90))
* undefined reduce ([24f0226](https://github.com/fredrikburmester/streamystats/commit/24f02260affcc0479452532af3b4e2247899da1b)), closes [#85](https://github.com/fredrikburmester/streamystats/issues/85)

## [1.7.0](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.6.0...streamystat-v1.7.0) (2025-05-17)


### Features

* add average watch time and longest streak columns to UserTable with sorting functionality ([52bec4c](https://github.com/fredrikburmester/streamystats/commit/52bec4c96cf31aa76590d4f609f39297fb574cec))
* add size prop to Poster component and implement fallback for missing images ([d6ce62a](https://github.com/fredrikburmester/streamystats/commit/d6ce62ae97d0e38e6349603f0434bb38fe4df3a6))
* add utility function to format time since last activity in ActiveSessions component ([59695d2](https://github.com/fredrikburmester/streamystats/commit/59695d2b785e91be432d02948de9cd571c2fbc98))
* ai recommendations ([74893b7](https://github.com/fredrikburmester/streamystats/commit/74893b703203eeb2215ff72e61f2ba519523991e))
* enhance ActiveSessions component with improved layout, additional session details, and IP address display ([157ab07](https://github.com/fredrikburmester/streamystats/commit/157ab07f0c38a24cd9aa380a28bf3b21ca097b08))
* enhance ActiveSessions component with playback method badge and update session mapping for transcoding info ([0ce49fa](https://github.com/fredrikburmester/streamystats/commit/0ce49fa3aa33f41f92d7b32f6e71d410d61758f2))
* enhance dashboard cards to display percentage labels and improve responsiveness for better data visualization ([ea2311d](https://github.com/fredrikburmester/streamystats/commit/ea2311dcb436dfcab6ff59fb44063059f37c90ea))
* enhance dashboard cards with custom labels and filter out zero counts for better data representation ([c2ed475](https://github.com/fredrikburmester/streamystats/commit/c2ed47544c7f3359539db5c5d3a6be90fe17864b))
* enhance ItemWatchStatsTable with improved sorting, additional item details, and responsive layout adjustments ([0cd9a31](https://github.com/fredrikburmester/streamystats/commit/0cd9a3176786ffab5894e1a28a19710bffd9c0df))
* enhance user activity tables with links to user profiles and improve chart responsiveness ([89e943c](https://github.com/fredrikburmester/streamystats/commit/89e943c6c24de52a5a453c3b8b94f413b7971323))
* enhance user interface with improved hover effects and link functionality across activity and user tables ([9df24e1](https://github.com/fredrikburmester/streamystats/commit/9df24e1271b96627ea399160e5a8b602a726b1a5))
* enhance user interface with JellyfinAvatar component and improve session display ([df93e51](https://github.com/fredrikburmester/streamystats/commit/df93e519f1e7ccda12295d5f75ccd807d7af8f19))
* integrate Poster component into HistoryTable and ItemWatchStatsTable for improved item display ([6f696a5](https://github.com/fredrikburmester/streamystats/commit/6f696a5b7e273a76e0a582c1c8d4632963a5d86b))
* pwa ([f59f6b5](https://github.com/fredrikburmester/streamystats/commit/f59f6b526693deae1328969500ba01e11fa10a9c))
* replace Avatar component with JellyfinAvatar for user display in UserLeaderboardTable ([cd1994b](https://github.com/fredrikburmester/streamystats/commit/cd1994b8b1bc098e51d4aa85f174fb82a019d476))
* user leaderboard on dashboard ([9b4f4cb](https://github.com/fredrikburmester/streamystats/commit/9b4f4cbd993f9908e3b215049116e84a3ee45777)), closes [#52](https://github.com/fredrikburmester/streamystats/issues/52)


### Bug Fixes

* add parent and index numbers to session mapping ([9440f5c](https://github.com/fredrikburmester/streamystats/commit/9440f5cd093e936cf412ed93eddc723d71fa5856))
* correct pluralization in 'No items watched yet' message in MostWatchedItems ([d5dcf83](https://github.com/fredrikburmester/streamystats/commit/d5dcf836ddb5496d5e8e8574c6b31779cf0fa8f6))
* correct pluralization in 'No items watched yet' message in MostWatchedItems component ([2dbe5c1](https://github.com/fredrikburmester/streamystats/commit/2dbe5c13fe8548964a61623f39c99bba681961af))
* design ([0f3aa83](https://github.com/fredrikburmester/streamystats/commit/0f3aa83a1453445969176038f84db03e9598bb49))
* improve resize observer handling in ChartContainer to prevent potential memory leaks ([b2f27cd](https://github.com/fredrikburmester/streamystats/commit/b2f27cda0b0fdb9ccf14d2c96c4e92114b18d801))
* update user page to handle optional searchParams and improve HistoryTable props ([8a215d0](https://github.com/fredrikburmester/streamystats/commit/8a215d08bf85fb5fb380c5906888d39572a6011c))

## [1.6.0](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.5.0...streamystat-v1.6.0) (2025-04-26)


### Features

* sync recently added items every other minute ([ec6b90e](https://github.com/fredrikburmester/streamystats/commit/ec6b90edcbdc0d32210dd0adbcd8dfdada4329a8))


### Bug Fixes

* container listening on 0.0.0.0 ([d5f013a](https://github.com/fredrikburmester/streamystats/commit/d5f013aa69c2d1b4de3244c4270dd753407fa27c))
* container listening on all interfaces ([b34cb1b](https://github.com/fredrikburmester/streamystats/commit/b34cb1b9dd1bdc5a8586e595accf05826d48ab67))
* only show UpdateNotifier to admin ([9fdf79b](https://github.com/fredrikburmester/streamystats/commit/9fdf79b1d0af40700fd54ad1d51dbbe5ce9380f2)), closes [#44](https://github.com/fredrikburmester/streamystats/issues/44)

## [1.5.0](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.4.0...streamystat-v1.5.0) (2025-04-23)


### Features

* new transcoding statistics ([f08b8d1](https://github.com/fredrikburmester/streamystats/commit/f08b8d1e9431a68a645f31013c49c0cfdb75fab2))
* new transcoding statistics cards ([d28f6ea](https://github.com/fredrikburmester/streamystats/commit/d28f6ea65c227b95d1e98ad08baf8db695dbfe53))


### Bug Fixes

* alert dialog broke import ([5d23841](https://github.com/fredrikburmester/streamystats/commit/5d23841cb622a90c101d21629bf4700cf7a579e2))
* move statistics placement ([f3bc735](https://github.com/fredrikburmester/streamystats/commit/f3bc735d0fa8f28fe40e3a9244d436e2ad4e297c))
* use correct tz ([0d2082e](https://github.com/fredrikburmester/streamystats/commit/0d2082e6d6ccf37c27b80d53f3f5526560b3d7a4))

## [1.4.0](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.3.0...streamystat-v1.4.0) (2025-04-21)


### Features

* active sessions ([a6d95c3](https://github.com/fredrikburmester/streamystats/commit/a6d95c3c328eea12b1ed33fdc9118cc843b449b0))
* activities log + series/movies split in dashboard statistics ([db15983](https://github.com/fredrikburmester/streamystats/commit/db15983476a14dfdfa51a74cdc83abdc55052cf8))
* activity log ([9904dd2](https://github.com/fredrikburmester/streamystats/commit/9904dd2f5dc303612cd3669b6e7a205f042f1a29))
* add error boundary to page ([4147dcd](https://github.com/fredrikburmester/streamystats/commit/4147dcdfd2fc0868b60d934ab7be8c59ca1c2ae5))
* add release please ([b40fdaa](https://github.com/fredrikburmester/streamystats/commit/b40fdaad038c4cf296c15cd2f9815b5f87b01362))
* added item watch statistics ([165259c](https://github.com/fredrikburmester/streamystats/commit/165259c492e54984bf2fba566a01d636a4f4fbc5))
* delete add server as admin ([33c7a36](https://github.com/fredrikburmester/streamystats/commit/33c7a363991e788bdb49149723490b8300e5e9be))
* handle auth in middleware ([7d29d3a](https://github.com/fredrikburmester/streamystats/commit/7d29d3ae0fe1b32f072197fc511517a26fcebc60))
* hide most watch sections ([defd5bd](https://github.com/fredrikburmester/streamystats/commit/defd5bdc6c3888167f89d4f6dcfd366cdc2ca940))
* images ([0480bee](https://github.com/fredrikburmester/streamystats/commit/0480bee9dbf5a616c1ae4b7af33b337d046d35fb))
* import data from jellystat ([f0c39d5](https://github.com/fredrikburmester/streamystats/commit/f0c39d50707310216e11a293a5a1879ab9747a6e))
* import/export/backup session data from Streamystats ([63ec9a3](https://github.com/fredrikburmester/streamystats/commit/63ec9a37cb3d0e191da636f07e059b3be7847286))
* item specific statistics + api endpoint for items ([da5361d](https://github.com/fredrikburmester/streamystats/commit/da5361d8271f3fc708d6eb2d17f6ad82bfa7ec4a))
* item specific statistics + api endpoint for items ([26d7584](https://github.com/fredrikburmester/streamystats/commit/26d75842821f39c7f3019ff8a82840a12640769e))
* library stats ([f1efa1d](https://github.com/fredrikburmester/streamystats/commit/f1efa1da23e6296672d574228cb1339cb0424f26))
* most watched items ([b8a2f31](https://github.com/fredrikburmester/streamystats/commit/b8a2f31a6f726dbf36ef03d508bd95f6d68ee7b6))
* movie/episode split for dashboard stats ([167dc32](https://github.com/fredrikburmester/streamystats/commit/167dc327c7773c59fe0d0cb91bc1186d37bbbae2))
* new favicon ([c644990](https://github.com/fredrikburmester/streamystats/commit/c64499008daf2049346a615a7a8d1ae7c7bad734))
* personal stats including spider graph for genres ([da8a664](https://github.com/fredrikburmester/streamystats/commit/da8a66411814d0e698f20ddf1db590d8a3d1b45c))
* playback reporting plugin import data ([0f94891](https://github.com/fredrikburmester/streamystats/commit/0f9489199ff2890e4296f522b289d82fef2d52ca))
* playback reporting plugin import data ([f72ff9a](https://github.com/fredrikburmester/streamystats/commit/f72ff9a201fc708af30dcbf71714df3f1303dd4a))
* posters ([79e4acc](https://github.com/fredrikburmester/streamystats/commit/79e4acc2ea19724403fa1ebbf698a79471f2e66a))
* pre-work for eventual tautulli import ([7b4c946](https://github.com/fredrikburmester/streamystats/commit/7b4c946f240d25c31714a4e36e44c5276960e0ea))
* remove playback reporting plugin dep and use sessions instead ([dbc43b3](https://github.com/fredrikburmester/streamystats/commit/dbc43b37dba680481eca578c703cb0470606b8f6))
* show active sessions on dashboard ([fd7c4f8](https://github.com/fredrikburmester/streamystats/commit/fd7c4f8ea5bbedc81d8654154c823173a198fddb))
* specify libraries included on libraries page ([d63b72c](https://github.com/fredrikburmester/streamystats/commit/d63b72cf9255b90e4f78098e1c46383441090019))
* svg icon ([e369d27](https://github.com/fredrikburmester/streamystats/commit/e369d2737fc4e91ea2dc352d759e0349cbc7191a))
* total watch time for series in history table ([95bbd3a](https://github.com/fredrikburmester/streamystats/commit/95bbd3a1ca68f1e3f0a0c25692d40715b356eec3))
* user longest streak ([d3caff0](https://github.com/fredrikburmester/streamystats/commit/d3caff0de2ea1676eaa67e8be82c623097bb7f6d))
* version badge and toast ([f5993bb](https://github.com/fredrikburmester/streamystats/commit/f5993bbf1d32d1ae857fa5853976972aea2753e1))
* watch time per hour ([61c9903](https://github.com/fredrikburmester/streamystats/commit/61c9903c2471ae2a7c6963090d8ec0ac051d7d96))


### Bug Fixes

* add cache control to release fetch ([8410505](https://github.com/fredrikburmester/streamystats/commit/8410505924ad7681f8b4b70cd4df541fb622b371))
* add cache to search items ([256834b](https://github.com/fredrikburmester/streamystats/commit/256834b0616ae6d240b2b0f402db5bdb16211bce))
* add debug logs ([9252616](https://github.com/fredrikburmester/streamystats/commit/9252616a606e0fe3d3a023691ccdb1447782d734))
* add gitignore ([f3cf783](https://github.com/fredrikburmester/streamystats/commit/f3cf7834179d650fc4d80a24fe94584e514491da))
* add modal confirm with info about duplicate entires ([891d9e7](https://github.com/fredrikburmester/streamystats/commit/891d9e7d52fcdd58f4c190af85700c074a3d990a))
* add sha to version badge [skip ci] ([5945318](https://github.com/fredrikburmester/streamystats/commit/5945318ba865823379e63d5fa5f8f857ebf36db9))
* add subtitle ([fb71529](https://github.com/fredrikburmester/streamystats/commit/fb715292b3cd1170288334eea8d0260719694c10))
* allow auth header (or cookie) ([56cd123](https://github.com/fredrikburmester/streamystats/commit/56cd1239fce8db921ee4b5edd1a0b9f51aa32958))
* better filtering ([23ab43b](https://github.com/fredrikburmester/streamystats/commit/23ab43bc6ef59b0ca5984f9e4c36a7b45238cd2a))
* better sync and cleanup ([229be4e](https://github.com/fredrikburmester/streamystats/commit/229be4e607975483baca238db197af0a25503306))
* breadcrumb casing ([3d56eaf](https://github.com/fredrikburmester/streamystats/commit/3d56eafb526287965add6068611b0e6807e36edb))
* broken home link ([eb32d96](https://github.com/fredrikburmester/streamystats/commit/eb32d96ad33ead86c30ce84788047cbeb5e9c45c))
* build ([73924c8](https://github.com/fredrikburmester/streamystats/commit/73924c8e6c5107c37aa4b5520458a420a0a56cfd))
* change name to library ([03d7089](https://github.com/fredrikburmester/streamystats/commit/03d70894c069cea9ce452713cc741e3ec88c8453))
* checkmark ([35c8fd6](https://github.com/fredrikburmester/streamystats/commit/35c8fd6b9abd8e55200902ac22bf78745cf58769))
* clear design for login/setup ([e0e24c0](https://github.com/fredrikburmester/streamystats/commit/e0e24c092c5b31854178d7c4d98cbe5a2252ed9b))
* combine accordion [skip ci] ([95b137f](https://github.com/fredrikburmester/streamystats/commit/95b137f62449c5466f223b121337d25f9dbf735b))
* cookie use in wrong context ([4c30d78](https://github.com/fredrikburmester/streamystats/commit/4c30d780a93164f956ecdb292563ad60f77a668e))
* cookie use in wrong context (2) ([8f20750](https://github.com/fredrikburmester/streamystats/commit/8f20750ae170ff36bb0ffc32a3bfe63d1cc03282))
* cookie use in wrong context (3) ([b1744bd](https://github.com/fredrikburmester/streamystats/commit/b1744bd42c057b48f9c7b37ac45f9dd4a1b0e812))
* cookies on safari ([20a2160](https://github.com/fredrikburmester/streamystats/commit/20a2160957354b0cbe96617acc013b5d1c98e3c3))
* correct instructions ([61d03c8](https://github.com/fredrikburmester/streamystats/commit/61d03c8caf70d8f050e919a3f71eae2d77f20360))
* correct version in "update available" ([23ffa44](https://github.com/fredrikburmester/streamystats/commit/23ffa441b4279b44acca891a02f1ea5f821e0841))
* create user if login before user sync ([32c6fd9](https://github.com/fredrikburmester/streamystats/commit/32c6fd996dc839842dd571adc2d3a2d522c61994))
* design ([7664f3f](https://github.com/fredrikburmester/streamystats/commit/7664f3fc51b90be3bf173ab852dffbd000e8847b))
* design ([f84cf1e](https://github.com/fredrikburmester/streamystats/commit/f84cf1ef97e8eac78da396894c6a04f27502fb6b))
* don't use secure cookie for local deploy ([7d75ae1](https://github.com/fredrikburmester/streamystats/commit/7d75ae1fe75ee0b17a9e3697225c099e499b335d))
* even more logs and robust checking ([f50f0f8](https://github.com/fredrikburmester/streamystats/commit/f50f0f8b876e4da9909350acdcdc63f557520fdc))
* fetch correct server ([9f371e4](https://github.com/fredrikburmester/streamystats/commit/9f371e4506a64a159bf830d226c0bc408405caa9))
* fetch correct server on settings page ([b1beebb](https://github.com/fredrikburmester/streamystats/commit/b1beebb67b4b19d2676a133bd9b80edeac444b51))
* filter by type ([24ff630](https://github.com/fredrikburmester/streamystats/commit/24ff6308a8ef04b36540fdd4890c79071dfe2f3f))
* forgot users page in middleware ([fd73dfc](https://github.com/fredrikburmester/streamystats/commit/fd73dfceb5ed5bf1244d2352c91de053f4fea958))
* handle possible empty data ([0193dc3](https://github.com/fredrikburmester/streamystats/commit/0193dc30bb443daacfb44401861126de8b6a0cd1))
* hide tasks for non admin users ([0853e2d](https://github.com/fredrikburmester/streamystats/commit/0853e2d4f17a179c53c29265d6ecd9b02975cbe3))
* hide user count from non admin ([5ca29e7](https://github.com/fredrikburmester/streamystats/commit/5ca29e792fa275d038540ef5fcb6dd5b1c491365))
* hide users page from non admin ([1d0bbdb](https://github.com/fredrikburmester/streamystats/commit/1d0bbdb255e22190cc9321f025afcec744c600ed))
* history table pagination and user scoped data ([e184d0e](https://github.com/fredrikburmester/streamystats/commit/e184d0ed924c626fb36b0cd8e7f310fc9ba4ba30))
* icon ([75ca1f3](https://github.com/fredrikburmester/streamystats/commit/75ca1f3dcb86b6c750741536b231f3e9019f1eb1))
* if none select all ([adde487](https://github.com/fredrikburmester/streamystats/commit/adde487ca7b1fac31e8729730d15750e1fe7a395))
* improve loading with server components ([1dc67fa](https://github.com/fredrikburmester/streamystats/commit/1dc67fade7dd1ab932b1cf542d6dea1bf8906a4a))
* improve login page with servers list ([328f435](https://github.com/fredrikburmester/streamystats/commit/328f435b056949d356be35f5e978c944e406dab1))
* improve middleware logic ([0d8d0f7](https://github.com/fredrikburmester/streamystats/commit/0d8d0f7a24afbd806d681c1a4a6fcb0a25228f29))
* improve settings page ([9cbeeec](https://github.com/fredrikburmester/streamystats/commit/9cbeeecd6a99648975a01204163676464582900b))
* incorrect dialog title location for sr ([e98e862](https://github.com/fredrikburmester/streamystats/commit/e98e862f29a3eb776f80e99919c9845ecf314bc9))
* incorrect redirect on base url / ([186d69c](https://github.com/fredrikburmester/streamystats/commit/186d69cbaa3e3c340b9ddd374a6b85795d889b35))
* incorrect routing when going to / ([ec61238](https://github.com/fredrikburmester/streamystats/commit/ec61238d5f03d680436d23da150bea575fd7ca67))
* inf redirect new server ([97acfaa](https://github.com/fredrikburmester/streamystats/commit/97acfaa1a60b725c560b55a2d9b6ff954ffeeb8e))
* instructions ([8b4ba54](https://github.com/fredrikburmester/streamystats/commit/8b4ba546b6f74fb2a8a2458579a8eab3b841c43c))
* last run time for wrong sync task ([5ed8082](https://github.com/fredrikburmester/streamystats/commit/5ed80827d1baca51720d6a6544aee53aa62fd18a))
* mobile design ([18edbab](https://github.com/fredrikburmester/streamystats/commit/18edbab268462dc755a592e6ecc09db39d88e746))
* modal for delete server ([136f636](https://github.com/fredrikburmester/streamystats/commit/136f636c888cbb84e5939474490f6b2175356d3f))
* more secure routing ([800ea1b](https://github.com/fredrikburmester/streamystats/commit/800ea1b1cb267865cf5e25639352ee86098c67e2))
* move build variabled and move to node 23 ([e63e988](https://github.com/fredrikburmester/streamystats/commit/e63e9889c609f9d5842a5f8f2cc392fecbb38508))
* name undefined ([4a1c08b](https://github.com/fredrikburmester/streamystats/commit/4a1c08bb95089c83b55b630287283ff8bb48d43d))
* new bun lock file format ([936e568](https://github.com/fredrikburmester/streamystats/commit/936e568fdcf89964cb63a52972907cb6794f5c5c))
* no jumping sort in active sessions ([5043379](https://github.com/fredrikburmester/streamystats/commit/5043379f7eb37befefdcbf03def2137ff2e68b85))
* only admin can see active sessions ([da4e30a](https://github.com/fredrikburmester/streamystats/commit/da4e30a01c2fb4d246df62eab3c42d15cb9e7810))
* padding ([3070dde](https://github.com/fredrikburmester/streamystats/commit/3070ddeb9ef7c404c594628d747768ab2c25fc85))
* redirect to login ([cda9a1e](https://github.com/fredrikburmester/streamystats/commit/cda9a1e581744c9af691cdecbc66d9e762a2568c))
* redirect to login ([7029144](https://github.com/fredrikburmester/streamystats/commit/7029144d5f256838dae91a4e8067cddd28cfe8f1))
* redirect to login if logged out ([17db124](https://github.com/fredrikburmester/streamystats/commit/17db124139a2d602e8e1c8b14013dbfde82d2692))
* remove build time [skip ci] ([22d90a7](https://github.com/fredrikburmester/streamystats/commit/22d90a7045b92a760ca5b5019c60629766b4479f))
* remove logging ([e7d1ed6](https://github.com/fredrikburmester/streamystats/commit/e7d1ed644ad96e37a75d2f49a55cc45fc9d127e6))
* remove old users and undefined error ([642ea33](https://github.com/fredrikburmester/streamystats/commit/642ea33877948b11815cf452fb7d5097230bc4ca))
* restructure sidebar sections ([4209677](https://github.com/fredrikburmester/streamystats/commit/4209677b184c76707cb780f06e1b88e390654a0f))
* save server id in cookie ([05143cd](https://github.com/fredrikburmester/streamystats/commit/05143cdee5ae979545df61408f48ee6b83efee57))
* server undefined ([74ee990](https://github.com/fredrikburmester/streamystats/commit/74ee9905afb23a7aa57f563abebcbb474a4a4fb2))
* set cookie secure flag based on X-Forwarded-Proto header ([e04bc5a](https://github.com/fredrikburmester/streamystats/commit/e04bc5a883900579c0fa07cbf207d549f05c1cce))
* show only update available for admin ([600b4c8](https://github.com/fredrikburmester/streamystats/commit/600b4c84db111c1d451a4dc7e2788e660cac4062))
* small changes ([c1c13cb](https://github.com/fredrikburmester/streamystats/commit/c1c13cb24a1b918a40ee29f092227126eda1cd27))
* specify on ([d62afdd](https://github.com/fredrikburmester/streamystats/commit/d62afdd038bebb85ceb5fe41f0db458bf809840b))
* spelling ([b9cf948](https://github.com/fredrikburmester/streamystats/commit/b9cf948e0ded3e0110bdb06fe1845ee992e25f08))
* text ([7440705](https://github.com/fredrikburmester/streamystats/commit/74407058d7112bf9c83de9c989960bb3e13b4404))
* title ([9965a81](https://github.com/fredrikburmester/streamystats/commit/9965a819cd98c5495a39a15ae99dcce0267267dc))
* undefined fix? ([1c15a50](https://github.com/fredrikburmester/streamystats/commit/1c15a50c4b0139d2bed56dba3f9ab6b8bec69530))
* use bearer token ([cc85d5b](https://github.com/fredrikburmester/streamystats/commit/cc85d5b7b750502bf0dcf1264d2c26f850a75a63))
* use node instead of bun ([8e3a961](https://github.com/fredrikburmester/streamystats/commit/8e3a96138f3e39a8472478569e1d15d9fc01211a))
* users WatchTimePerDay - date formatting ([9bab785](https://github.com/fredrikburmester/streamystats/commit/9bab785305f4fb738f3df5fec085b2b84d9e36c5))
* users WatchTimePerDay - Invalid Date ([77fce32](https://github.com/fredrikburmester/streamystats/commit/77fce325ded3e83727841a92f8b038ab565486d3))
* wording [skip ci] ([df07033](https://github.com/fredrikburmester/streamystats/commit/df0703313c03bb1e51e91a1199ef9dfb33235753))
* working ([54f8f2a](https://github.com/fredrikburmester/streamystats/commit/54f8f2a278bf8618604b3cd325883cfb46b37fd5))
* wrong weekday ([40e30aa](https://github.com/fredrikburmester/streamystats/commit/40e30aaf26fe407af3649a497be5ee9c7dd8ebe8))

# Changelog

## [1.7.0](https://github.com/fredrikburmester/streamystats/compare/v1.6.0...v1.7.0) (2025-05-05)


### Features

* add removed_at field to Item model and implement logic for marking items as removed during sync ([56e91b7](https://github.com/fredrikburmester/streamystats/commit/56e91b76a125303ac1e757df8c88fc4efbb3e2ed))
* add removed_at field to Library model and update synchronization logic to mark libraries as removed ([0be4b08](https://github.com/fredrikburmester/streamystats/commit/0be4b08986092a410ee0cac0b20b9e58f7ccc5a4))
* enhance library queries by integrating active library checks and improving performance ([192dbb9](https://github.com/fredrikburmester/streamystats/commit/192dbb9d86bb17aad3c8cd119ce786f92ee0b6d3))
* enhance SQLite configuration for adaptive caching and memory storage based on system resources during playback session export ([9990724](https://github.com/fredrikburmester/streamystats/commit/9990724647ed427396d47fc0ca828cd972f17ae3))
* enhance user activity tables with links to user profiles and improve chart responsiveness ([89e943c](https://github.com/fredrikburmester/streamystats/commit/89e943c6c24de52a5a453c3b8b94f413b7971323))
* enhance user interface with improved hover effects and link functionality across activity and user tables ([9df24e1](https://github.com/fredrikburmester/streamystats/commit/9df24e1271b96627ea399160e5a8b602a726b1a5))
* improve library and statistics queries by using subqueries for active library checks and adding documentation ([0667c73](https://github.com/fredrikburmester/streamystats/commit/0667c73907a26dc3f3a10bad8f63992106a4f7ea))
* increase transaction timeout for large exports and schedule temporary file deletion after response ([3a7deb0](https://github.com/fredrikburmester/streamystats/commit/3a7deb06ed3b07595526af1b3ea47169f4ef1abc))
* update database configuration to use environment variables and enhance .env.example file ([36c0b8c](https://github.com/fredrikburmester/streamystats/commit/36c0b8cc1ab3f578d56a64fadc85dd7ce459cfb5))


### Bug Fixes

* adjust sync start time with a 5-second buffer and improve logging for removed items ([6ecfe39](https://github.com/fredrikburmester/streamystats/commit/6ecfe393dfaa26485a0099d636010963cc60532b))
* ensure resource cleanup after export failure in backup_controller to prevent resource leaks ([fdcaba0](https://github.com/fredrikburmester/streamystats/commit/fdcaba09c34a1ac90f5d96738c59a8a0c20f3819))
* implement orphaned item cleanup and enhance library processing in Jellyfin sync ([83a357a](https://github.com/fredrikburmester/streamystats/commit/83a357a68fdcacf0946bff24b82686b6f2d3fb92))
* improve error handling in configure_sqlite function to log failures when executing system command and parsing memory info ([ebd851a](https://github.com/fredrikburmester/streamystats/commit/ebd851a1d9364b68fcc275f9df11982b9044a82c))
* update user page to handle optional searchParams and improve HistoryTable props ([8a215d0](https://github.com/fredrikburmester/streamystats/commit/8a215d08bf85fb5fb380c5906888d39572a6011c))

## [1.6.0](https://github.com/fredrikburmester/streamystats/compare/v1.5.0...v1.6.0) (2025-04-26)


### Features

* sync recently added items every other minute ([ec6b90e](https://github.com/fredrikburmester/streamystats/commit/ec6b90edcbdc0d32210dd0adbcd8dfdada4329a8))

## [1.5.0](https://github.com/fredrikburmester/streamystats/compare/v1.4.0...v1.5.0) (2025-04-23)


### Features

* import transcoding info when importing from jellystat ([8085ac9](https://github.com/fredrikburmester/streamystats/commit/8085ac913aee9a3a84fd98b7623e67530b46e8b6))
* new transcoding statistics ([f08b8d1](https://github.com/fredrikburmester/streamystats/commit/f08b8d1e9431a68a645f31013c49c0cfdb75fab2))


### Bug Fixes

* arm64 build error ([7be28fc](https://github.com/fredrikburmester/streamystats/commit/7be28fc542c7971a445d7caf1e154e6a5c54c437))
* errors ([fa657b8](https://github.com/fredrikburmester/streamystats/commit/fa657b85baccc266166d845e6a36f37c05ae8e4e))

## [1.4.0](https://github.com/fredrikburmester/streamystats/compare/v1.3.0...v1.4.0) (2025-04-21)


### Features

* active sessions ([a6d95c3](https://github.com/fredrikburmester/streamystats/commit/a6d95c3c328eea12b1ed33fdc9118cc843b449b0))
* activities log + series/movies split in dashboard statistics ([db15983](https://github.com/fredrikburmester/streamystats/commit/db15983476a14dfdfa51a74cdc83abdc55052cf8))
* activity log ([9904dd2](https://github.com/fredrikburmester/streamystats/commit/9904dd2f5dc303612cd3669b6e7a205f042f1a29))
* add release please ([b40fdaa](https://github.com/fredrikburmester/streamystats/commit/b40fdaad038c4cf296c15cd2f9815b5f87b01362))
* added item watch statistics ([165259c](https://github.com/fredrikburmester/streamystats/commit/165259c492e54984bf2fba566a01d636a4f4fbc5))
* arm build ([4e626bb](https://github.com/fredrikburmester/streamystats/commit/4e626bb1bb88d2d20f808dc9c70181e081a8ba5a))
* arm build ([7f2bd5e](https://github.com/fredrikburmester/streamystats/commit/7f2bd5ec8941078266acce564d6db9092d70ca44))
* delete add server as admin ([33c7a36](https://github.com/fredrikburmester/streamystats/commit/33c7a363991e788bdb49149723490b8300e5e9be))
* images ([0480bee](https://github.com/fredrikburmester/streamystats/commit/0480bee9dbf5a616c1ae4b7af33b337d046d35fb))
* import data from jellystat ([f0c39d5](https://github.com/fredrikburmester/streamystats/commit/f0c39d50707310216e11a293a5a1879ab9747a6e))
* import/export/backup session data from Streamystats ([63ec9a3](https://github.com/fredrikburmester/streamystats/commit/63ec9a37cb3d0e191da636f07e059b3be7847286))
* item specific statistics + api endpoint for items ([da5361d](https://github.com/fredrikburmester/streamystats/commit/da5361d8271f3fc708d6eb2d17f6ad82bfa7ec4a))
* item specific statistics + api endpoint for items ([26d7584](https://github.com/fredrikburmester/streamystats/commit/26d75842821f39c7f3019ff8a82840a12640769e))
* library stats ([f1efa1d](https://github.com/fredrikburmester/streamystats/commit/f1efa1da23e6296672d574228cb1339cb0424f26))
* more stats ([3b3946b](https://github.com/fredrikburmester/streamystats/commit/3b3946b2f8ab64d33cfef854c400cc06ad3fdd83))
* most watched items ([b8a2f31](https://github.com/fredrikburmester/streamystats/commit/b8a2f31a6f726dbf36ef03d508bd95f6d68ee7b6))
* movie/episode split for dashboard stats ([167dc32](https://github.com/fredrikburmester/streamystats/commit/167dc327c7773c59fe0d0cb91bc1186d37bbbae2))
* personal stats including spider graph for genres ([da8a664](https://github.com/fredrikburmester/streamystats/commit/da8a66411814d0e698f20ddf1db590d8a3d1b45c))
* playback reporting plugin import data ([0f94891](https://github.com/fredrikburmester/streamystats/commit/0f9489199ff2890e4296f522b289d82fef2d52ca))
* playback reporting plugin import data ([f72ff9a](https://github.com/fredrikburmester/streamystats/commit/f72ff9a201fc708af30dcbf71714df3f1303dd4a))
* posters ([79e4acc](https://github.com/fredrikburmester/streamystats/commit/79e4acc2ea19724403fa1ebbf698a79471f2e66a))
* pre-work for eventual tautulli import ([7b4c946](https://github.com/fredrikburmester/streamystats/commit/7b4c946f240d25c31714a4e36e44c5276960e0ea))
* remove playback reporting plugin dep and use sessions instead ([dbc43b3](https://github.com/fredrikburmester/streamystats/commit/dbc43b37dba680481eca578c703cb0470606b8f6))
* show active sessions on dashboard ([fd7c4f8](https://github.com/fredrikburmester/streamystats/commit/fd7c4f8ea5bbedc81d8654154c823173a198fddb))
* specify libraries included on libraries page ([d63b72c](https://github.com/fredrikburmester/streamystats/commit/d63b72cf9255b90e4f78098e1c46383441090019))
* total watch time for series in history table ([95bbd3a](https://github.com/fredrikburmester/streamystats/commit/95bbd3a1ca68f1e3f0a0c25692d40715b356eec3))
* user longest streak ([d3caff0](https://github.com/fredrikburmester/streamystats/commit/d3caff0de2ea1676eaa67e8be82c623097bb7f6d))
* watch time per hour ([61c9903](https://github.com/fredrikburmester/streamystats/commit/61c9903c2471ae2a7c6963090d8ec0ac051d7d96))


### Bug Fixes

* allow nil name by re-naming to "Untitled Item" ([dc2a8e3](https://github.com/fredrikburmester/streamystats/commit/dc2a8e3c0fa544acf10a227dc2e88cbc4f318c2f))
* better docker image and entrypoint for the server ([3668560](https://github.com/fredrikburmester/streamystats/commit/3668560cf83d8a97d6365f7ab701c152e07bf19b))
* better sync and cleanup ([229be4e](https://github.com/fredrikburmester/streamystats/commit/229be4e607975483baca238db197af0a25503306))
* convert all string fields to text to prevent truncation errors ([ebdd46d](https://github.com/fredrikburmester/streamystats/commit/ebdd46d0d675c86a3cbcf383599fd620eafcca9e))
* correct ids mapping from jellystat ([b55bea9](https://github.com/fredrikburmester/streamystats/commit/b55bea911dfe41cde40551d100804332bc3591b7))
* create user if login before user sync ([32c6fd9](https://github.com/fredrikburmester/streamystats/commit/32c6fd996dc839842dd571adc2d3a2d522c61994))
* delete and ignore duplicate playback session entries ([1a2f945](https://github.com/fredrikburmester/streamystats/commit/1a2f9451626e9f21175fa9804b54e17d2c6e86c1))
* docs ([00a9bc5](https://github.com/fredrikburmester/streamystats/commit/00a9bc5ec781dcf1ded779b5b32333430f541191))
* don't update version ([c002e26](https://github.com/fredrikburmester/streamystats/commit/c002e264d8fdc0a2faf743b1305f1704319d0125))
* filter by type ([24ff630](https://github.com/fredrikburmester/streamystats/commit/24ff6308a8ef04b36540fdd4890c79071dfe2f3f))
* handle large item requests + don't truncate text ([4e054bc](https://github.com/fredrikburmester/streamystats/commit/4e054bc1a1986905ec6c81635422fb77f4742793))
* history table pagination and user scoped data ([e184d0e](https://github.com/fredrikburmester/streamystats/commit/e184d0ed924c626fb36b0cd8e7f310fc9ba4ba30))
* import error ([801d168](https://github.com/fredrikburmester/streamystats/commit/801d168bd5829a4c0d778dfd3a36c32ad00d6fbb))
* improve jellyfin sync import by handling errors better ([e6bc339](https://github.com/fredrikburmester/streamystats/commit/e6bc3390762b600a96881f213d6b11cc0b836f85))
* improve jellyfin sync reliability and error handling ([93c35cd](https://github.com/fredrikburmester/streamystats/commit/93c35cd0e3e4cbf1eef9ffc3185c77f4eb6917ce))
* improve user watch streak calculation reliability ([e62c637](https://github.com/fredrikburmester/streamystats/commit/e62c6371e06f7e95126e25b0c4e1b0b23157fe32))
* include season item statistics ([118a484](https://github.com/fredrikburmester/streamystats/commit/118a48443084c0a8e903a97c5f30cac308256774))
* include tools version ([174f6f7](https://github.com/fredrikburmester/streamystats/commit/174f6f72d4090744b1f297aadf425fc4235e6308))
* Prevent duplicate item conflicts during DB batch operations ([bda533a](https://github.com/fredrikburmester/streamystats/commit/bda533a78d3129271153623dc63d5f836b3c64df))
* redirect to login ([cda9a1e](https://github.com/fredrikburmester/streamystats/commit/cda9a1e581744c9af691cdecbc66d9e762a2568c))
* remove old users and undefined error ([642ea33](https://github.com/fredrikburmester/streamystats/commit/642ea33877948b11815cf452fb7d5097230bc4ca))
* remove references to playback activities ([5a74bdd](https://github.com/fredrikburmester/streamystats/commit/5a74bdd9c1cc5245afac881e116ac2ff658635fc))
* remove references to playback_activity ([a458363](https://github.com/fredrikburmester/streamystats/commit/a4583633ab5d42167590bf6b31154f2794e17de2))
* run full sync on server create ([58b80c8](https://github.com/fredrikburmester/streamystats/commit/58b80c85753c53ad0a6636c13b3896cb3de0afc5))
* sanitize name and ensure name is never null ([01729b4](https://github.com/fredrikburmester/streamystats/commit/01729b44f1fe953aaa0ac37160dc2dd0c4d0047b))
* skip folders ([fc4c2e0](https://github.com/fredrikburmester/streamystats/commit/fc4c2e0e62d0095a889cddb8a331c8220ac0e15b))
* specify on ([d62afdd](https://github.com/fredrikburmester/streamystats/commit/d62afdd038bebb85ceb5fe41f0db458bf809840b))
* specify on ([e2b4d69](https://github.com/fredrikburmester/streamystats/commit/e2b4d696ffef47589c0a0f329a0409851da56e38))
* start full sync when server starts ([5344abe](https://github.com/fredrikburmester/streamystats/commit/5344abe8c2b993bd2dc9fe61c2ff307f5e335dd5))
* text longer than 255chars ([334ddc6](https://github.com/fredrikburmester/streamystats/commit/334ddc6db68e60ae3013af9a85466f3312ae4d95))
* unused code ([baf1004](https://github.com/fredrikburmester/streamystats/commit/baf100445e362ebc2b989941261617bdbda408f9))
* version ([92a0e96](https://github.com/fredrikburmester/streamystats/commit/92a0e9648368e3450203e9d0f5f873a4b9b6f1fe))
* working ([1f9523b](https://github.com/fredrikburmester/streamystats/commit/1f9523bf1048481c77cfef2e3ba95a0f8550b9a2))
* working ([54f8f2a](https://github.com/fredrikburmester/streamystats/commit/54f8f2a278bf8618604b3cd325883cfb46b37fd5))

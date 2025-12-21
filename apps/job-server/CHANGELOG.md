# Changelog

## [3.0.0](https://github.com/fredrikburmester/streamystats/compare/job-server-v2.0.0...job-server-v3.0.0) (2025-12-21)


### ⚠ BREAKING CHANGES

* This is a major version upgrade with breaking changes requiring migration from v1.x to v2.x including database schema changes, new compose file and new Docker images

### Features

* dangerously merge similar items ([94e9532](https://github.com/fredrikburmester/streamystats/commit/94e9532d02b0b13fd4b967bf645c38e2c9850cec))
* enhance text preparation for item embeddings with structured metadata and improved people data handling ([822840d](https://github.com/fredrikburmester/streamystats/commit/822840de52812e7adfea17bc426e4d09048bbed4))
* global watchtime page date picker ([1c09ffc](https://github.com/fredrikburmester/streamystats/commit/1c09ffc2ae09df8db7588e95c2e7aade02c76e0c))
* **job-server:** allow setting of listening host ([c98d82a](https://github.com/fredrikburmester/streamystats/commit/c98d82a84e7bbc71566ed2f9f68a7d964ca63c1c))
* **job-server:** make cron schedules configurable via env vars ([3edef46](https://github.com/fredrikburmester/streamystats/commit/3edef46f4f164bb36c4cbefc8ab8a48bee2d0750))
* major version 2.0.0 release ([d12e3aa](https://github.com/fredrikburmester/streamystats/commit/d12e3aa5a824dbbbd5e072966f3ac538e54afded))
* more detection rules ([1d27511](https://github.com/fredrikburmester/streamystats/commit/1d27511c926f6544867e15e6f3bfc32024ce381f))
* refresh button ([c4ca818](https://github.com/fredrikburmester/streamystats/commit/c4ca818e76cfb91171b24e492ce1e49181aea0bb))
* support multiple ai servers / models for embedding ([0939e5a](https://github.com/fredrikburmester/streamystats/commit/0939e5a1a3b68514e1a790c6b1c0a14896a150bb))
* user fingerprinting for security and determining shared accounts ([52adda9](https://github.com/fredrikburmester/streamystats/commit/52adda93439bb01515c14a4d4a015b1fe58dd25e))
* user sync ([9610f2c](https://github.com/fredrikburmester/streamystats/commit/9610f2c4d26ce6887c26271c385f10c9523a2b3b))


### Bug Fixes

* add deleted items as schedule ([cd4ac64](https://github.com/fredrikburmester/streamystats/commit/cd4ac648c14fd120cd7051456908e9fc9f83ee71))
* add force insert provider id if missing ([6c0fc43](https://github.com/fredrikburmester/streamystats/commit/6c0fc43fb2638d5df4b47d6dacc148889026f7f7))
* apply stale job cleanup fix to all cleanup functions ([f92e1d0](https://github.com/fredrikburmester/streamystats/commit/f92e1d0cac91ed834532b3be7f1725c32d2f10f6))
* better copy for skipped job because of server budy ([b8af5a8](https://github.com/fredrikburmester/streamystats/commit/b8af5a82f1d6caff01e225a5adf63270a80aa384))
* better logs ([4357274](https://github.com/fredrikburmester/streamystats/commit/435727465e8d676eb74d9581aa931e691b876cca))
* better match logic ([9041a72](https://github.com/fredrikburmester/streamystats/commit/9041a72b9f01e568f662efc675e4f86c1671da34))
* better matching ([e0d4ce5](https://github.com/fredrikburmester/streamystats/commit/e0d4ce5237ba4e520d134948d31a6e42246b7b54))
* better size ([d21efa1](https://github.com/fredrikburmester/streamystats/commit/d21efa1cdd382ad64bce46d73ca3d51c5248480b))
* build issue ([b5fd8ea](https://github.com/fredrikburmester/streamystats/commit/b5fd8ea1470b325f77558bcbb64ba6cb9bfbb030))
* consider PlayMethode DirectStream as direct ([a1f68f6](https://github.com/fredrikburmester/streamystats/commit/a1f68f6af67f3f7eaee000a636aeb46c0b4eb41b))
* copy geo files to expected location ([bbdf17d](https://github.com/fredrikburmester/streamystats/commit/bbdf17d1b32b1d33cce73d7e99944de421de912d))
* delete old deletedAt item in favor of new item with data ([e2e1ee0](https://github.com/fredrikburmester/streamystats/commit/e2e1ee016023945befa8f892b3466dc46a800662))
* duplicate fingerprint cleanup and improvement ([f975ab1](https://github.com/fredrikburmester/streamystats/commit/f975ab180aae7979344c36bab340a90a4eec8d13))
* embedding index ([4a2d8d6](https://github.com/fredrikburmester/streamystats/commit/4a2d8d658bf4acd873cdea75744135089a42353d))
* embeding dimensions edge case ([c1d4b88](https://github.com/fredrikburmester/streamystats/commit/c1d4b88a5f5984f46e280c86ea1df3b588c41a32))
* healthcheck in dockerfiles ([7d10ac7](https://github.com/fredrikburmester/streamystats/commit/7d10ac7ae83b03854d97e96f8353af26ab65f77b))
* https://github.com/fredrikburmester/streamystats/issues/181 ([30a6e48](https://github.com/fredrikburmester/streamystats/commit/30a6e48f0537aa71d3c395a32ade469ce3816437))
* implement conditional startup full sync based on SKIP_STARTUP_FULL_SYNC environment variable ([4e03ea7](https://github.com/fredrikburmester/streamystats/commit/4e03ea7d36cd8c1cba3fab1956c6612671e32ef2))
* include provider ids in sync process ([21ccb03](https://github.com/fredrikburmester/streamystats/commit/21ccb032148d0b46be40adf885613ca65275aa35))
* **jellyfin:** ensure isFolder defaults to false ([4fdeaea](https://github.com/fredrikburmester/streamystats/commit/4fdeaea22497ab86a926ca0f5b6a60186b556a32))
* job issues ([f13c1c3](https://github.com/fredrikburmester/streamystats/commit/f13c1c3aa17ee07f03ce2af96bc7183fdbd79a9c))
* **job-server:** apply sourcery-ai suggestions wrt PORT validation ([86ef6a9](https://github.com/fredrikburmester/streamystats/commit/86ef6a9543a751f1d56f22dee83becc1c07c4ea0))
* **job-server:** do not print warning for system activites ([30a6e48](https://github.com/fredrikburmester/streamystats/commit/30a6e48f0537aa71d3c395a32ade469ce3816437))
* **job-server:** update stale jobs instead of inserting duplicates ([c6a7d6a](https://github.com/fredrikburmester/streamystats/commit/c6a7d6a55f23ad897d62935a6a29312eadf46668))
* lock bun version ([65fdeee](https://github.com/fredrikburmester/streamystats/commit/65fdeee5f5befbc53375bd8b99882cefe5019461))
* logs ([c399473](https://github.com/fredrikburmester/streamystats/commit/c3994736d5672110647b76583dd5ff3c3bb23a7a))
* logs ([ae74975](https://github.com/fredrikburmester/streamystats/commit/ae7497545fa9e219ad6b85801eb542e3886bfb1b))
* memory issue ([392b370](https://github.com/fredrikburmester/streamystats/commit/392b3709dfadc6fd7b48950014061a8821c689e4))
* missing geoip file ([2fca30a](https://github.com/fredrikburmester/streamystats/commit/2fca30abd79ad78fe7521337a55fa614d62b8c11))
* missing trancoding stats ([591ba7f](https://github.com/fredrikburmester/streamystats/commit/591ba7f26abc7a378097d833a118bf96aedc8849))
* no frozen lockfile ([14f4668](https://github.com/fredrikburmester/streamystats/commit/14f46682b60d993f2aa94863b97ae3266a4f0b9e))
* prevent false deletions when Jellyfin server is down or return 0 items ([8462efb](https://github.com/fredrikburmester/streamystats/commit/8462efbf7c143963df3a2962db47ff366885a28b))
* provider name ([55aa421](https://github.com/fredrikburmester/streamystats/commit/55aa421a73b4c9df4d94cef00ac302802b0fa28b))
* removed library causes failed sync ([260fa0b](https://github.com/fredrikburmester/streamystats/commit/260fa0b1c1dd0e6651490eabb60eefe9534149fd))
* rename database fields in job status endpoint ([cd543a2](https://github.com/fredrikburmester/streamystats/commit/cd543a22f4b5fcc73545c2c79fb2124446e07d18))
* restore or migrate items on normal sync ([1afed43](https://github.com/fredrikburmester/streamystats/commit/1afed436647b75926ae784d3758cd25e108f6c86))
* status types and docs ([ac190d8](https://github.com/fredrikburmester/streamystats/commit/ac190d8f9524301f99be2380a990dbe58012bf16))
* stuck in sync servers ([50a4020](https://github.com/fredrikburmester/streamystats/commit/50a402000f8350f23c170adc06c40128eefaeb7e))
* sync items on start ([56a14a9](https://github.com/fredrikburmester/streamystats/commit/56a14a98f0837393eac6c8c21b3d763fbd3e8d4f))
* unwrap nested errors in formatError function for improved error handling ([116af7a](https://github.com/fredrikburmester/streamystats/commit/116af7a52c84838b002e62b9225e49028aa215d0))
* update job status endpoint to include 'queue' in the URL path ([f1d4a04](https://github.com/fredrikburmester/streamystats/commit/f1d4a04006d88cb3fdf78ae9102eac08767f537c))
* use SQL[] universally and remove any restore Server ([4bdf766](https://github.com/fredrikburmester/streamystats/commit/4bdf766415b78be0c048286f7621e688b7304281))

# Changelog

## [1.7.0](https://github.com/fredrikburmester/streamystats/compare/streamystat-v1.6.0...streamystat-v1.7.0) (2025-05-05)


### Features

* add average watch time and longest streak columns to UserTable with sorting functionality ([52bec4c](https://github.com/fredrikburmester/streamystats/commit/52bec4c96cf31aa76590d4f609f39297fb574cec))
* add size prop to Poster component and implement fallback for missing images ([d6ce62a](https://github.com/fredrikburmester/streamystats/commit/d6ce62ae97d0e38e6349603f0434bb38fe4df3a6))
* add utility function to format time since last activity in ActiveSessions component ([59695d2](https://github.com/fredrikburmester/streamystats/commit/59695d2b785e91be432d02948de9cd571c2fbc98))
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

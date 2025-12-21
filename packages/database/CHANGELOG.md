# Changelog

## [3.0.0](https://github.com/fredrikburmester/streamystats/compare/database-v2.0.0...database-v3.0.0) (2025-12-21)


### ⚠ BREAKING CHANGES

* This is a major version upgrade with breaking changes requiring migration from v1.x to v2.x including database schema changes, new compose file and new Docker images

### Features

* **database:** add migration to fix stale jobs & auto-cleanup old records ([78e31bf](https://github.com/fredrikburmester/streamystats/commit/78e31bf6f95429d2148eafb3da003320ca07de23))
* major version 2.0.0 release ([d12e3aa](https://github.com/fredrikburmester/streamystats/commit/d12e3aa5a824dbbbd5e072966f3ac538e54afded))
* seasonal recomendations ([e839603](https://github.com/fredrikburmester/streamystats/commit/e8396038a0d5acb78387e1f302436406033fb7df))
* support multiple ai servers / models for embedding ([0939e5a](https://github.com/fredrikburmester/streamystats/commit/0939e5a1a3b68514e1a790c6b1c0a14896a150bb))
* user fingerprinting for security and determining shared accounts ([52adda9](https://github.com/fredrikburmester/streamystats/commit/52adda93439bb01515c14a4d4a015b1fe58dd25e))


### Bug Fixes

* add indexes for better performance ([4232cf7](https://github.com/fredrikburmester/streamystats/commit/4232cf7ce9160e693474a2d37fe6d6deea268a52))
* **design:** rename chat ai and fix hover effect ([1937baa](https://github.com/fredrikburmester/streamystats/commit/1937baa3731bb6a0aeb756665af3414676d616e5))
* duplicate fingerprint cleanup and improvement ([f975ab1](https://github.com/fredrikburmester/streamystats/commit/f975ab180aae7979344c36bab340a90a4eec8d13))
* idempotent migration ([3465228](https://github.com/fredrikburmester/streamystats/commit/346522826c50f96f097f56c0b8edc43bb11022bc))
* timestamp issue ([51dfffd](https://github.com/fredrikburmester/streamystats/commit/51dfffd0790d81024aee83354e1ebc76bf35c2cc))

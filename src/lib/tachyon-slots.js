'use strict';

// Single source of truth: the GPT A/B slot-attribute logic lives in the shared
// @particle/tachyon-image library (src/slots) and is consumed identically by the
// composer, this CLI, and the on-device OTA service. This is a thin re-export so
// `require('../lib/tachyon-slots')` keeps working for the tachyon slot/update commands.
module.exports = require('@particle/tachyon-image').slots;

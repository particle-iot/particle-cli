/**
 ******************************************************************************
 * @file    js/settings.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Setting module
 ******************************************************************************
  Copyright (c) 2014 Spark Labs, Inc.  All rights reserved.

  This program is free software; you can redistribute it and/or
  modify it under the terms of the GNU Lesser General Public
  License as published by the Free Software Foundation, either
  version 3 of the License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
  Lesser General Public License for more details.

  You should have received a copy of the GNU Lesser General Public
  License along with this program; if not, see <http://www.gnu.org/licenses/>.
  ******************************************************************************
 */


var fs = require('fs');
var extend = require('xtend');

var settings = {
    commandPath: "./commands/",
    apiUrl: "https://api.spark.io",
    access_token: null,
    minimumApiDelay: 500,

    //useOpenSSL: true,
    useSudoForDfu: false,

    //2 megs -- this constant here is arbitrary
    MAX_FILE_SIZE: 1024 * 1024 * 2
};

settings.commandPath = __dirname + "/commands/";
settings.overridesFile = __dirname + "/spark.config.json";


settings.loadOverrides = function () {
    try {
        if (fs.existsSync(settings.overridesFile)) {
            settings.overrides = JSON.parse(fs.readFileSync(settings.overridesFile));
            settings = extend(settings, settings.overrides);
        }
    }
    catch (ex) {
        console.error('There was an error reading ' + settings.overrides + ': ', ex);
    }
};
settings.override = function (key, value) {
    if (!settings.overrides) {
        settings.overrides = {};
    }

    settings.overrides[key] = value;
    settings = extend(settings, settings.overrides);

    try {
        fs.writeFileSync(settings.overridesFile, JSON.stringify(settings.overrides, null, 2));
    }
    catch (ex) {
        console.error('There was an error writing ' + settings.overrides + ': ', ex);
    }
};

settings.loadOverrides();
module.exports = settings;

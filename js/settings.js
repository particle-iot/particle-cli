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
var path = require('path');
var extend = require('xtend');
var utilities = require('./lib/utilities.js');

var settings = {
    commandPath: "./commands/",
    apiUrl: "https://api.spark.io",
    access_token: null,
    minimumApiDelay: 500,

    //useOpenSSL: true,
    useSudoForDfu: false,

    //2 megs -- this constant here is arbitrary
    MAX_FILE_SIZE: 1024 * 1024 * 2,

    overridesFile: null,

    notSourceExtensions: [
        ".ds_store",
        ".jpg",
        ".gif",
        ".png",
        ".include",
        ".ignore",
        ".ds_store",
        ".git",
        ".bin"
    ],
    showIncludedSourceFiles: true,

    dirIncludeFilename: "spark.include",
    dirExcludeFilename: "spark.ignore",

    knownApps: {
        "deep_update_2014_06": "binaries/deep_update_2014_06.bin",
        "cc3000": "binaries/cc3000-patch-programmer.bin",
        "tinker": "binaries/spark_tinker.bin",
        "voodoo": "binaries/voodoospark.bin"
    },

    commandMappings: path.join(__dirname, "mappings.json")
};

settings.commandPath = __dirname + "/commands/";

//fix the paths on the known apps mappings
for(var name in settings.knownApps) {
    settings.knownApps[name] = path.join(__dirname, settings.knownApps[name]);
}


settings.findHomePath = function() {
    var envVars = [
        'home',
        'HOME',
        'HOMEPATH',
        'USERPROFILE'
    ];

    for(var i=0;i<envVars.length;i++) {
        var dir = process.env[envVars[i]];
        if (dir && fs.existsSync(dir)) {
            return dir;
        }
    }
    return __dirname;
};

settings.ensureFolder = function() {
    var sparkDir = path.join(settings.findHomePath(), ".spark");
    if (!fs.existsSync(sparkDir)) {
        fs.mkdirSync(sparkDir);
    }
    return sparkDir;
};

settings.findOverridesFile = function(profile) {
    profile = profile || settings.profile || "spark";

    var sparkDir = settings.ensureFolder();
    return path.join(sparkDir, profile + ".config.json");
};

settings.loadOverrides = function (profile) {
    profile = profile || settings.profile || "spark";

    try {
        var filename = settings.findOverridesFile(profile);
        if (fs.existsSync(filename)) {
            settings.overrides = JSON.parse(fs.readFileSync(filename));
            settings = extend(settings, settings.overrides);
        }
    }
    catch (ex) {
        console.error('There was an error reading ' + settings.overrides + ': ', ex);
    }
    return settings;
};

settings.whichProfile = function() {
    settings.profile = "spark";

    var sparkDir = settings.ensureFolder();
    var proFile = path.join(sparkDir, "profile.json");      //proFile, get it?
    if (fs.existsSync(proFile)) {
        var data = JSON.parse(fs.readFileSync(proFile));

        settings.profile = (data) ? data.name : "spark";
        settings.profile_json = data;
    }
};

/**
 * in another file in our user dir, we store a profile name that switches between setting override files
 */
settings.switchProfile = function(profileName) {
    var sparkDir = settings.ensureFolder();
    var proFile = path.join(sparkDir, "profile.json");      //proFile, get it?
    var data = {
        name: profileName
    };
    fs.writeFileSync(proFile, JSON.stringify(data, null, 2));
};

settings.override = function (profile, key, value) {
    if (!settings.overrides) {
        settings.overrides = {};
    }

    if (!settings[key]) {
        // find any key that matches our key, regardless of case
        var realKey = utilities.matchKey(key, settings, true);
        if (realKey) {
            console.log("Using the setting \"" + realKey + "\" instead ");
            key = realKey;
        }
    }

    //store the new value (redundant)
    settings[key] = value;

    //store that in overrides
    settings.overrides[key] = value;

    //make sure our overrides are in sync
    settings = extend(settings, settings.overrides);

    try {
        var filename = settings.findOverridesFile(profile);
        fs.writeFileSync(filename, JSON.stringify(settings.overrides, null, 2));
    }
    catch (ex) {
        console.error('There was an error writing ' + settings.overrides + ': ', ex);
    }
};

settings.whichProfile();
settings.loadOverrides();
module.exports = settings;

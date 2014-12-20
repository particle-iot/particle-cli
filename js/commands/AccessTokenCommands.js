/**
 ******************************************************************************
 * @file    js/commands/AccessTokenCommands.js
 * @author  Kyle Marsh (kyle@cs.hmc.edu)
 * @source  https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Access Token commands module
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

var when = require('when');
var sequence = require('when/sequence');
var pipeline = require('when/pipeline');

var extend = require('xtend');
var fs = require('fs');
var path = require('path');
var readline = require('readline');
var util = require('util');

var ApiClient = require('../lib/ApiClient.js');
var BaseCommand = require("./BaseCommand.js");
var prompts = require('../lib/prompts.js');
var settings = require('../settings.js');

var AccessTokenCommands = function (cli, options) {
    AccessTokenCommands.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(AccessTokenCommands, BaseCommand);
AccessTokenCommands.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "token",
    description: "tools to help you manage access tokens on your account",

    init: function () {
        this.addOption("list", this.listAccessTokens.bind(this), "List all access tokens for your account");
        //this.addOption("revoke", this.revokeAccessToken.bind(this), "Revoke an access token");
        //this.addOption("new", this.createAccessToken.bind(this), "Create a new access token");
    },

    checkArguments: function (args) {
        this.options = this.options || {};

        if (!this.options.force) {
            this.options.force = utilities.tryParseArgs(args,
                "--force",
                null
            );
        }
    },

    getAccessTokens: function () {
        console.error("Checking with the cloud...");

        return pipeline([
            prompts.getCredentials,
            function (creds) {
                var api = new ApiClient(settings.apiUrl);
                return api.listTokens(creds[0], creds[1]);
            }
        ]);
    },

    listAccessTokens: function () {

        this.getAccessTokens().then(function (tokens) {
            try {
                var lines = [];
                for (var i = 0; i < tokens.length; i++) {
                    // TODO: put a marker on settings.acccess_token
                    // TODO: sort by expiration date
                    token = tokens[i];
                    lines.push('Token: ' + token.token);
                    lines.push('  Expires At: ' + token.expires_at);
                    lines.push('  Client:     ' + token.client);
                }
                console.log(lines.join("\n"));
            }
            catch (ex) {
                console.error("Error during list " + ex);
            }
        }, function(err) {
            console.log("Please make sure you're online and logged in.");
        });
    },

    _: null
});

module.exports = AccessTokenCommands;

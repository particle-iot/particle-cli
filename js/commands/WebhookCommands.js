/**
 ******************************************************************************
 * @file    js/commands/SubscribeCommand.js
 * @author  David Middlecamp (david@spark.io)
 * @company Spark ( https://www.spark.io/ )
 * @source https://github.com/spark/spark-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Webhook commands module
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

var settings = require('../settings.js');
var path = require('path');
var extend = require('xtend');
var util = require('util');
var fs = require('fs');

var BaseCommand = require("./BaseCommand.js");
var ApiClient = require('../lib/ApiClient.js');


var WebhookCommand = function (cli, options) {
    WebhookCommand.super_.call(this, cli, options);
    this.options = extend({}, this.options, options);

    this.init();
};
util.inherits(WebhookCommand, BaseCommand);
WebhookCommand.prototype = extend(BaseCommand.prototype, {
    options: null,
    name: "webhooks",
    description: "helpers for watching Core event streams",

    init: function () {
        this.addOption("create", this.createHook.bind(this), "Creates a postback to the given url when your event is sent");
        this.addOption("list", this.listHooks.bind(this), "Show your current Webhooks");
        this.addOption("delete", this.deleteHook.bind(this), "Deletes a Webhook");
    },

    createHook: function (eventName, url, coreID) {
        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return -1;
        }

        if (!eventName || (eventName == "")) {
            console.log("Please specify an event name");
            return -1;
        }

        api.createWebhook(eventName, url, coreID);
        return 0;
    },

    deleteHook: function (hookID) {
        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return -1;
        }

        if (!hookID || (hookID == "")) {
            console.log("Please specify a hook id");
            return -1;
        }

        api.deleteWebhook(hookID);
        return 0;
    },

    listHooks: function () {
        var api = new ApiClient(settings.apiUrl, settings.access_token);
        if (!api.ready()) {
            return -1;
        }

        when(api.listWebhooks()).then(
            function (hooks) {
                console.log("Found " + hooks.length + " hooks registered\n");
                for(var i=0;i < hooks.length;i++) {
                    var hook = hooks[i];
                    var line = [
                        "    ", (i+1),
                        ".) Hook #" + hook.id + " is watching for ",
                        "\""+hook.event+"\"",

                        "\n       ", " and posting to: " + hook.url,

                        (hook.deviceID) ? "\n       " + " for core " + hook.deviceID : "",

                        "\n       ", " created at " + hook.created_at,
                        "\n"
                    ].join("");

                    console.log(line);
                }
            },
            function (err) {
                console.error("Problem listing webhooks " + err);
            });
        return 0;
    },


    _: null
});

module.exports = WebhookCommand;

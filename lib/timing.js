/**
 ******************************************************************************
 * @file    lib/timing.js
 * @author  David Middlecamp (david@spark.io)
 * @company Particle ( https://www.particle.io/ )
 * @source https://github.com/spark/particle-cli
 * @version V1.0.0
 * @date    14-February-2014
 * @brief   Timing support module
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
var that = module.exports = {
	helpers: {

		waitFor: function (delay) {
			return function () {
				var temp = when.defer();
				console.log('.(delay:' + delay + ').');
				setTimeout(function () { temp.resolve(); }, delay);
				return temp.promise;
			};
		},

		waitASecond: function () {
			var temp = when.defer();
			console.log('..');
			setTimeout(function () { temp.resolve(); }, 1000);
			return temp.promise;
		},
		waitHalfSecond: function () {
			var temp = when.defer();
			console.log('.');
			setTimeout(function () { temp.resolve(); }, 500);
			return temp.promise;
		},
		waitFOREVER: function () {
			var temp = when.defer();
			console.log(
				'--------------------------------------------------------------------\n' +
				'WAITING FOREVER\n' +
				'--------------------------------------------------------------------\n'
				);
			return temp.promise;
		}
	}
};

/*
 ******************************************************************************
 Copyright (c) 2016 Particle Industries, Inc.  All rights reserved.

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

import {expect} from '../test-setup';

import {CLI} from '../../src/app/app.js';

describe('command parsing', () => {
	const sut = new CLI();

	it('an unknown command is not a new command', () => {
		expect(sut.isNewCommand(['asfdjklasdf'])).to.be.false;
	});

	it('detects a new command', () => {
		expect(sut.isNewCommand(['library', 'install'])).to.be.true;
	});

	it('detects a new command if the prefix is correct', () => {
		expect(sut.isNewCommand(['library', 'asfdjklasdf'])).to.be.true;
	});

});
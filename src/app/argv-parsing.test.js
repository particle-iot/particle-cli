'use strict';
const fs = require('fs');
const path = require('path');
const { expect } = require('../../test/setup');
const CLI = require('./cli');
const commandProcessor = require('./command-processor');

// Snapshot of how the whole command tree parses a broad set of command lines.
// It guards against behavior changes when yargs / yargs-parser are updated.
//
// To record a new snapshot after an intentional change:
//   UPDATE_ARGV_SNAPSHOT=1 npx mocha src/app/argv-parsing.test.js
const SNAPSHOT_FILE = path.join(__dirname, '../../test/__fixtures__/argv-parsing.snapshot.json');

// Command lines that exercise yargs-parser edge cases on real commands
const EDGE_CASES = [
	[],
	['--version'],
	['help'],
	['help', 'flash'],
	['flash', '0123456789abcdef01234567', 'tinker'],
	['flash', '12345', 'firmware.bin'],
	['flash', '00123', 'firmware.bin'],
	['flash', '1e3', 'firmware.bin'],
	['flash', '0x10', 'firmware.bin'],
	['flash', 'my_device', 'tinker', '--product', '00123'],
	['flash', 'my_device', 'tinker', '--product=12345'],
	['flash', '--local', 'firmware.bin', '--target', '5.5.0'],
	['flash', '--usb', 'firmware.bin', '--no-local'],
	['flash', '--local', '--local', 'firmware.bin'],
	['flash', '--yes', 'false', 'my_device'],
	['flash', '-vvv', '-q', 'my_device', 'tinker'],
	['flash', '--verbose', '--verbose', 'my_device', 'tinker'],
	['flash', 'my_device', 'tinker', '--', '--not-an-option', 'extra'],
	['call', 'my_device', 'digitalwrite', 'D7=HIGH'],
	['call', 'my_device', 'setValue', '-1'],
	['call', 'my_device', 'setValue', '--', '-1'],
	['call', 'my_device', 'echo', 'hello world, with = and "quotes"'],
	['publish', 'temp', '23.50', '--private'],
	['publish', 'temp', '0012', '--product', '12345'],
	['publish', 'event', '--public', '--private'],
	['subscribe', 'temp', '--device', '0123456789abcdef01234567', '--max', '5', '--until', 'data'],
	['subscribe', '--all'],
	['variable', 'get', 'my_device', 'temperature', '--time'],
	['variable', 'monitor', 'my_device', 'temperature', '--delay', '1000.5'],
	['list', 'online'],
	['list', '--json'],
	['usb', 'list', '--ids-only', '--exclude-dfu'],
	['usb', 'setup-done', '--reset'],
	['serial', 'monitor', '--follow', '--port', '/dev/tty.usbmodem1101'],
	['compile', 'argon', '.', '--target', '5.8.0', '--saveTo', 'out.bin'],
	['compile', 'p2', 'src/', 'lib/', '--followSymlinks'],
	['cloud', 'login', '--username', 'user@example.com', '--password', '123456'],
	['cloud', 'login', '--token', '0123456789abcdef0123456789abcdef01234567'],
	['login', '--sso'],
	['token', 'create', '--expires-in', '3600'],
	['token', 'create', '--never-expires'],
	['config', 'proxyUrl', 'http://proxy:8080'],
	['config', 'identify'],
	['keys', 'new', 'mykey', '--protocol', 'udp'],
	['library', 'search', 'neo pixel'],
	['library', 'add', 'neopixel@1.0.0'],
	['product', 'device', 'add', '12345', '0123456789abcdef01234567'],
	['product', 'device', 'add', '12345', '--file', 'devices.txt'],
	['function', 'call', 'my_device', 'fn', 'arg', '--product', '12345'],
	['webhook', 'create', 'event', 'https://example.com/hook', '--requestType', 'POST'],
	['nope', '--x'],
	['flash', '--unknown-flag', 'my_device'],
	['--interactive', 'list'],
	['update-cli', '--disable-automatic-updates'],
	['update-cli', '--version', '3.0.0']
];

// Turn `$0 $command foo "bar baz"` into an argv array for a command path
function exampleToArgv(example, commandPath) {
	const line = example.replace(/\$command/g, commandPath.join(' '));
	const tokens = line.match(/"[^"]*"|'[^']*'|\S+/g) || [];
	return tokens.slice(1).map((t) => t.replace(/^(["'])(.*)\1$/, '$2'));
}

function collectExamples(command, commandPath = []) {
	const lines = [];
	const examples = (command.options && command.options.examples) || {};
	for (const example of Object.keys(examples)) {
		lines.push(exampleToArgv(example, commandPath));
	}
	for (const sub of Object.values(command.commands || {})) {
		lines.push(...collectExamples(sub, [...commandPath, sub.name]));
	}
	return lines;
}

// Keep only what the parser decided, in a JSON friendly shape
function describeParse(argv) {
	const result = {};
	for (const key of Object.keys(argv).sort()) {
		if (key === 'clicommand' || key === '$0') {
			continue;
		}
		const value = argv[key];
		if (key === 'clierror') {
			result.clierror = value && { message: value.message, data: value.data };
		} else if (typeof value === 'function') {
			result[key] = '[function]';
		} else {
			result[key] = value === undefined ? '[undefined]' : value;
		}
	}
	result.command = argv.clicommand ? [argv.clicommand.name, argv.clicommand.parent && argv.clicommand.parent.name] : null;
	return result;
}

describe('command line parsing snapshot', function () {
	this.timeout(20000);
	let cli;

	before(() => {
		cli = new CLI();
		commandProcessor.parse(cli.rootCategory, [], null);
	});

	function parseAll() {
		const lines = [...EDGE_CASES, ...collectExamples(cli.rootCategory)];
		const results = {};
		for (const args of lines) {
			let result;
			try {
				result = describeParse(commandProcessor.parse(cli.rootCategory, args, null));
			} catch (error) {
				result = { thrown: error.message };
			}
			results[JSON.stringify(args)] = result;
		}
		return results;
	}

	it('parses every command line exactly like the recorded snapshot', () => {
		const actual = JSON.parse(JSON.stringify(parseAll()));
		if (process.env.UPDATE_ARGV_SNAPSHOT) {
			fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(actual, null, '\t') + '\n');
		}
		const expected = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));

		expect(Object.keys(actual).length).to.be.greaterThan(200);
		for (const line of Object.keys(expected)) {
			expect(actual[line], `particle ${JSON.parse(line).join(' ')}`).to.eql(expected[line]);
		}
		expect(Object.keys(actual)).to.have.members(Object.keys(expected));
	});
});

const { expect } = require('../../test/setup');
const { HalModuleParser, firmwareTestHelper, ModuleInfo } = require('binary-version-reader');
const { sortBinariesByDependency } = require('./dependency-walker');
describe('_sortBinariesByDependency', () => {

	const createModules = async () => {
		const parser = new HalModuleParser();
		const preBootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			moduleIndex: 0,
			moduleVersion: 1200,
			deps: []
		});
		const preBootloader = await parser.parseBuffer({ fileBuffer: preBootloaderBuffer });
		const bootloaderBuffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.BOOTLOADER,
			moduleIndex: 1,
			moduleVersion: 1210,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 0, version: 1200 }
			]
		});
		const bootloader = await parser.parseBuffer({ fileBuffer: bootloaderBuffer });
		const systemPart1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART,
			moduleIndex: 1,
			moduleVersion: 4100,
			deps: [
				{ func: ModuleInfo.FunctionType.BOOTLOADER, index: 1, version: 1210 }
			]
		});
		const systemPart1 = await parser.parseBuffer({ fileBuffer: systemPart1Buffer });
		const systemPart2Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.SYSTEM_PART,
			moduleIndex: 2,
			moduleVersion: 4100,
			deps: [
				{ func: ModuleInfo.FunctionType.SYSTEM_PART, index: 1, version: 4100 }
			]
		});
		const systemPart2 = await parser.parseBuffer({ fileBuffer: systemPart2Buffer });
		const userPart1Buffer = await firmwareTestHelper.createFirmwareBinary({
			moduleFunction: ModuleInfo.FunctionType.USER_PART,
			moduleIndex: 1,
			moduleVersion: 4100,
			deps: [
				{ func: ModuleInfo.FunctionType.SYSTEM_PART, index: 2, version: 4100 }
			]
		});
		const userPart1 = await parser.parseBuffer({ fileBuffer: userPart1Buffer });
		return [
			{ filename: 'preBootloader.bin', ...preBootloader },
			{ filename: 'bootloader.bin', ...bootloader },
			{ filename: 'systemPart1.bin', ...systemPart1 },
			{ filename: 'systemPart2.bin', ...systemPart2 },
			{ filename: 'userPart1.bin', ...userPart1 }
		];
	};

	it('returns a list of files sorted by dependency', async () => {
		const modules = await createModules();
		const expected = [
			modules.find( m => m.filename === 'preBootloader.bin'),
			modules.find( m => m.filename === 'bootloader.bin'),
			modules.find( m => m.filename === 'systemPart1.bin'),
			modules.find( m => m.filename === 'systemPart2.bin'),
			modules.find( m => m.filename === 'userPart1.bin'),
		];
		const binaries = await sortBinariesByDependency(modules);
		binaries.forEach((binary, index) => {
			expect(binary.filename).to.equal(expected[index].filename);
		});
	});
});

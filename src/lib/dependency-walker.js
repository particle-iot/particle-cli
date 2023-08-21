const { ModuleInfo } = require('binary-version-reader');

class DependencyWalker {
	constructor({ modules, log }) {
		this._log = log;
		this._modules = modules;
		this._adjacencyList = new Map();
	}

	sortByDependencies(modules) {
		if (modules) {
			this._modules = modules;
		}

		this._fillAdjacencyList();

		// This is pretty naive but works fine for our purposes
		const ordered = [];
		const visited = new Set();
		for (const [m, deps] of this._adjacencyList.entries()) {
			if (m in visited) {
				continue;
			}
			const chain = [];
			visited.add(m);
			chain.push(m);
			for (const d of deps) {
				if (d in visited) {
					continue;
				}
				visited.add(d);
				chain.push(d);
			}
			const last = chain[chain.length - 1];
			// Place into the appropriate location in the list
			ordered.splice(ordered.indexOf(last), 0, ...chain);
		}
		// Remove any duplicates
		return new Set(ordered);
	}

	_addEdgesByDependencies(module) {
		// Fills the adjacency list in the reverse order of the dependencies
		// e.g. system-part1 depends on bootloader: the list will contain bootloader -> system-part1 edge
		for (const dep of module.dependencies) {
			for (const m of this._modules) {
				if (dep.func === m.prefixInfo.moduleFunction &&
					dep.index === m.prefixInfo.moduleIndex &&
					dep.version === m.prefixInfo.moduleVersion) {
					// Version is ignored as we don't really known what's on device
					const moduleDependencies = this._adjacencyList.get(m);
					moduleDependencies.add(module);
				}
			}
		}
	}

	_fillAdjacencyList() {
		this._adjacencyList = new Map();
		for (const m of this._modules) {
			this._adjacencyList.set(m, new Set());
		}
		for (const m of this._modules) {
			this._addEdgesByDependencies(m);
		}
	}

}

async function sortBinariesByDependency(modules) {
	const binariesWithDependencies = [];
	// read every file and parse it

	// generate binaries before
	for (const binary of modules) {
		const binaryWithDependencies = {
			...binary,
			dependencies: []
		};
		if (binaryWithDependencies.prefixInfo.depModuleFunction !== 0) {
			const binaryDependency =
				modules.find(b =>
					b.prefixInfo.moduleIndex === binaryWithDependencies.prefixInfo.depModuleIndex &&
					b.prefixInfo.moduleFunction === binaryWithDependencies.prefixInfo.depModuleFunction &&
					b.prefixInfo.moduleVersion === binaryWithDependencies.prefixInfo.depModuleVersion
				);
			if (binaryDependency) {
				binaryWithDependencies.dependencies.push({
					func: binaryDependency.prefixInfo.moduleFunction,
					index: binaryDependency.prefixInfo.moduleIndex,
					version: binaryDependency.prefixInfo.moduleVersion
				});
			}
		}

		if (binary.prefixInfo.dep2ModuleFunction !== 0) {
			const binary2Dependency =
				modules.find(b =>
					b.prefixInfo.moduleIndex === binaryWithDependencies.prefixInfo.dep2ModuleIndex &&
					b.prefixInfo.moduleFunction === binaryWithDependencies.prefixInfo.depModuleFunction &&
					b.prefixInfo.moduleVersion === binaryWithDependencies.prefixInfo.depModuleVersion
				);
			if (binary2Dependency) {
				binaryWithDependencies.dependencies.push({
					func: binary2Dependency.prefixInfo.moduleFunction,
					index: binary2Dependency.prefixInfo.moduleIndex,
					version: binary2Dependency.prefixInfo.moduleVersion
				});
			}
		}
		binariesWithDependencies.push(binaryWithDependencies);
	}
	const dependencyWalker = new DependencyWalker({ modules: binariesWithDependencies });
	const sortedDependencies = dependencyWalker.sortByDependencies(binariesWithDependencies);

	return Array.from(sortedDependencies);

}



function moduleTypeToString(str) {
	switch (str) {
		case ModuleInfo.FunctionType.BOOTLOADER:
			return 'bootloader';
		case ModuleInfo.FunctionType.SYSTEM_PART:
			return 'systemPart';
		case ModuleInfo.FunctionType.USER_PART:
			return 'userPart';
		case ModuleInfo.FunctionType.RADIO_STACK:
			return 'radioStack';
		case ModuleInfo.FunctionType.NCP_FIRMWARE:
			return 'ncpFirmware';
		case ModuleInfo.FunctionType.ASSET:
			return 'assets';
		default:
			throw new Error(`Unknown module type: ${str}`);
	}
}

module.exports = {
	DependencyWalker,
	sortBinariesByDependency,
	moduleTypeToString
};

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

module.exports = {
	DependencyWalker
};

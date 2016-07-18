import promisify from 'promisify-node';
const fs = promisify('fs');
import path from 'path';

export default class ProjectProperties {
	constructor(dir, { filename = 'project.properties' } = {}) {
		this.dir = dir;
		this.filename = filename;
		this.fields = {}
	}

	name() {
		return path.join(this.dir, this.filename);
	}

	load() {
		return fs.readFile(this.name(), 'utf8')
			.then(data => this.parse(data))
	}

	parse(data) {
		this.fields = data.split('\n')
			.reduce((obj, line) => {
				const [field, value] = line.split('=');
				if (value !== undefined) {
					obj[field] = value;
				}
				return obj;
			}, {});
	}

	save() {
		const data = this.serialize();
		return fs.writeFile(this.name(), data, 'utf8');
	}

	serialize() {
		return Object.keys(this.fields).map(field => {
			return `${field}=${this.fields[field]}`;
		}).join('\n');
	}

	exists() {
		return fs.stat(this.name())
			.then(stats => stats.isFile(), () => false);
	}

	addDependency(name, version) {
		this.fields[this.dependencyField(name)] = version;
	}

	dependencyField(name) {
		return `dependency.${name}`
	}
}

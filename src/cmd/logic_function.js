
/**
 * Commands for managing encryption keys.
 * @constructor
 */
module.exports = class LogicFunctionsCommand {
	constructor() {
	}

    async list({ org }) {
        // TODO
    }

    async get({ org, name, id }) {
        // TODO
    }

    async create({ org, params: { filepath } }) {
        // TODO
    }

    async execute({ org, data, params: { filepath } }) {
        // TODO
    }

    async deploy({ org, params: { filepath }}) {
        // TODO
    }

    async disable({ org, nane, id }) {
        // TODO
    }

    async delete({ org, name, id }) {
        // TODO
    }

    async logs({ org, name, id, saveTo }) {
        // TODO
    }

}
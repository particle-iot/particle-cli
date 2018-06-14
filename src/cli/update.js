export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'update', 'Update the system firmware of a device via USB', {
		handler: (args) => {
			const UpdateCommand = require('../cmd/update');
			return new UpdateCommand().updateDevice();
		}
	});
};

module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'doctor', 'Put your device back into a healthy state', {
		handler: () => {
			const DoctorCommand = require('../cmd/doctor');
			return new DoctorCommand().deviceDoctor();
		}
	});
};

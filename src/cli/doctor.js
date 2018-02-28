export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'doctor', 'Puts your device back into a healthy state', {
		handler: (args) => {
			const DoctorCommand = require('../cmd/doctor');
			return new DoctorCommand(args).deviceDoctor();
		}
	});
};

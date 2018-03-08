export default ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'doctor', 'Put your device back into a healthy state', {
		handler: (args) => {
			const DoctorCommand = require('../cmd/doctor');
			return new DoctorCommand(args).deviceDoctor();
		}
	});
};

module.exports = ({ commandProcessor, root }) => {
	commandProcessor.createCommand(root, 'doctor', 'NOT SUPPORTED. Go to the device doctor tool at docs.particle.io/tools/doctor', {
		handler: () => {
			const DoctorCommand = require('../cmd/doctor');
			return new DoctorCommand().deviceDoctor();
		}
	});
};

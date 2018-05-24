const platformsByName = {
	core: 0,
	c: 0,
	photon: 6,
	p: 6,
	p1: 8,
	electron: 10,
	e: 10,
	duo: 88,
	d: 88,
	bluz: 103,
	b: 103
};

const platformsById = {
	0: 'Core',
	6: 'Photon',
	8: 'P1',
	10: 'Electron',
	31: 'Raspberry Pi',
	88: 'Duo',
	103: 'Bluz'
};

const notSourceExtensions = [
	'.ds_store',
	'.jpg',
	'.gif',
	'.png',
	'.include',
	'.ignore',
	'.git',
	'.bin'
];

const MAX_FILE_SIZE = 1024 * 1024 * 2;

module.exports = {
	platformsByName,
	platformsById,
	notSourceExtensions,
	MAX_FILE_SIZE
};

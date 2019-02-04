import ParticleApi from './api';
import settings from '../../settings';

import { openDeviceById } from 'particle-usb';
import { Spinner } from 'cli-spinner';
import { prompt } from 'inquirer';

import * as util from 'util';

function api() {
}

function dump(val) {
  console.log(util.inspect(val, { depth: null }));
}

export class MeshCommand {
	constructor() {
    this._token = settings.access_token;
    this._api = new ParticleApi(settings.apiUrl, { accessToken: this._token }).api;
	}

	async create(args) {
    const s = new Spinner();
    try {
      s.setSpinnerTitle('Querying the device info...');
      s.start();
      const dev = await this._getDevice(args.params.device);
      s.setSpinnerTitle('Connecting to the device via USB...');
      const usbDev = await openDeviceById(dev.id);
      s.stop(true);
      let pwd = args.password;
      if (!pwd) {
        const r = await prompt([{
          name: 'password',
          type: 'password',
          message: 'Please enter a password for the new network'
        }, {
          name: 'confirm',
          type: 'password',
          message: 'Confirm the password'
        }]);
        if (r.password != r.confirm) {
          throw new Error('The entered passwords do not match');
        }
        pwd = r.password;
      }
      s.setSpinnerTitle('Registering network on the Cloud...');
      s.start();
      let r = await this._api.createMeshNetwork({
        name: args.params.name,
        deviceId: dev.id,
        auth: this._token
      });
      const netId = r.body.network.id;
      s.setSpinnerTitle('Creating network...');
      await usbDev.createMeshNetwork({
        id: netId,
        name: args.params.name,
        password: pwd
      });
      await usbDev.leaveListeningMode();
      s.stop(true);
      console.log('Done.');
    } catch (e) {
      throw e;
    } finally {
      if (s) {
        s.stop(true);
      }
    }
	}

  async add(args) {
    const s = new Spinner();
    try {
      s.setSpinnerTitle('Querying the network info...');
      s.start();
      let net = await this._api.getMeshNetwork({
        networkId: args.params.network,
        auth: this._token
      });
      net = net.body;
      s.setSpinnerTitle('Querying the device info...');
      const comm = await this._getDevice(args.params.commissioner);
      const joiner = await this._getDevice(args.params.joiner);
      s.setSpinnerTitle('Connecting to the device via USB...');
      const commDev = await openDeviceById(comm.id);
      const joinerDev = await openDeviceById(joiner.id);
      s.setSpinnerTitle('Registering the joiner device on the Cloud...');
      const r = await this._api.addMeshNetworkDevice({
        networkId: net.id,
        deviceId: joiner.id,
        auth: this._token
      });
      s.setSpinnerTitle('Adding the device to the network...');
      await commDev.startCommissioner();
      await joinerDev.joinMeshNetwork(commDev);
      await commDev.stopCommissioner();
      await joinerDev.setSetupDone();
      await joinerDev.leaveListeningMode();
      s.stop(true);
      console.log('Done.');
    } catch (e) {
      throw e;
    } finally {
      if (s) {
        s.stop(true);
      }
    }
  }

  async remove(args) {
    if (args.params.device) {
      return this._removeNetworkDevice(args);
    } else {
      return this._removeNetwork(args);
    }
  }

  async list(args) {
    if (args.params.network) {
      return this._listNetworkDevices(args);
    } else {
      return this._listNetworks(args);
    }
  }

  async _listNetworks(args) {
    let r = await this._api.listMeshNetworks({
      auth: this._token
    });
    if (r.body.length == 0) {
      console.log('No networks found');
      return;
    }
    r.body.forEach(n => {
      console.log(n.name);
    });
  }

  async _listNetworkDevices(args) {
    let r = await this._api.listMeshNetworkDevices({
      networkId: args.params.network,
      auth: this._token
    });
    if (r.body.length == 0) {
      console.log('No devices found');
      return;
    }
    r.body.forEach(d => {
      console.log(`${d.name} [${d.id}]`);
    });
  }

  async _removeNetwork(args) {
  }

  async _removeNetworkDevice(args) {
    const s = new Spinner();
    try {
      s.setSpinnerTitle('Querying device info...');
      s.start();
      const dev = await this._getDevice(args.params.device);
      if (!dev.network || !dev.network.id) {
        throw new Error('This device is not a member of a mesh network');
      }
      s.setSpinnerTitle('Connecting to the device via USB');
      const usbDev = await openDeviceById(dev.id);
      s.setSpinnerTitle('Removing the device from the network');
      await usbDev.leaveMeshNetwork();
      await this._api.removeMeshNetworkDevice({
        networkId: dev.network.id,
        deviceId: dev.id,
        auth: this._token
      })
      s.stop(true);
      console.log('Done.');
    } finally {
      if (s) {
        s.stop(true);
      }
    }
  }

  async _getDevice(idOrName) {
    const r = await this._api.getDevice({
      deviceId: idOrName,
      auth: this._token
    });
    return r.body;
  }
}

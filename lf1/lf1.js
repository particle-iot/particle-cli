import Particle from 'particle:core';
export default function main({ event }) {
	Particle.publish('logic-publish', event.eventData, { productId: 18552 });
}

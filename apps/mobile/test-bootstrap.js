const { bootstrap } = require('@monicon/core');

async function run() {
  console.log('Bootstrapping Monicon (one-time build)...');
  try {
    await bootstrap({ watch: false });
    console.log('Successfully generated icons!');
  } catch (error) {
    console.error('Error during icon generation:', error);
  }
}

run();

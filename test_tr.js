import translate from 'translate';

async function test() {
  translate.engine = 'google';
  try {
    const res = await translate('Hello world', { to: 'ta', from: 'en' });
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}

test();

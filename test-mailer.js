// Test the mailer
const { getMailer } = require('./lib/mailer.ts');

async function main() {
  const mailer = await getMailer();
  console.log('Mailer:', mailer.name);
  try {
    await mailer.send({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
      text: 'Test',
    });
    console.log('SUCCESS: Email sent via', mailer.name);
  } catch (e) {
    console.error('FAILED:', e.message);
  }
}

main().catch(console.error);

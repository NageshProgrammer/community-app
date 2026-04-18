
const url = 'https://aotikggjdpsfxudpkwbe.supabase.co/rest/v1/';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdGlrZ2dqZHBzZnh1ZHBrd2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1NDEyNjIsImV4cCI6MjA5MDExNzI2Mn0.4HeO3byoqvSEIjKH7Da87iZlTwLQXM-ywdv8m1lvqJQ';

console.log('Testing connection to Supabase...');
fetch(url, { headers: { apikey: key } })
  .then(res => {
    console.log('Status:', res.status);
    return res.text();
  })
  .then(text => console.log('Response:', text))
  .catch(err => console.error('Error:', err));

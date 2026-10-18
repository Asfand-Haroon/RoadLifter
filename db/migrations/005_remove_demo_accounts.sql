DELETE FROM users
WHERE email IN (
  'sender@demo.com',
  'driver1@demo.com',
  'driver2@demo.com',
  'driver3@demo.com'
);

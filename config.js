/* Where her typed answers are sent so the goose (you) can read them.
   url + publishable key come from Supabase > Project Settings > API.
   The publishable key is meant to be public: the table only allows inserting,
   so nobody who opens the game can read, change or delete answers.
   Leave both empty to keep answers on the phone only. */
window.POND_CONFIG = {
  url: 'https://pvutbqwqltwyaereppzp.supabase.co',
  key: 'sb_publishable_vjGRWKp7cCU1oSGsrWR27g_dBYUOKpI'
};

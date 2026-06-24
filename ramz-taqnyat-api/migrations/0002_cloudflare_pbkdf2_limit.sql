UPDATE users
SET password_salt = 'qyqETzHrT6u25zyMLro+Lw==',
    password_hash = 'lHgEFTMaUP0r5R8+kKIVSzIz+Xtg4xMSsSYdqRrsE58=',
    password_iterations = 100000,
    updated_at = CURRENT_TIMESTAMP
WHERE id = 'admin-aliayashi';

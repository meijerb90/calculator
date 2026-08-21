CREATE TABLE IF NOT EXISTS calculations (
    id SERIAL PRIMARY KEY,
    calculation TEXT NOT NULL,
    answer NUMERIC NOT NULL
);

create table if not exists users (
	id uuid primary key,
	email text unique not null,
	password_hash text not null,
	name text not null,
	dob date,
	gender text,
	blood_group text,
	avatar_url text,
	created_at timestamptz not null,
	last_login timestamptz,
	is_active boolean not null default true,
	is_admin boolean not null default false
);

create table if not exists devices (
	id uuid primary key,
	user_id uuid not null references users(id),
	device_id_str text unique not null,
	name text not null,
	location text,
	firmware_version text,
	last_seen timestamptz,
	is_active boolean not null default true,
	api_key text not null
);

create table if not exists ecg_records (
	id uuid primary key,
	user_id uuid not null references users(id),
	device_id uuid not null references devices(id),
	recorded_at timestamptz not null,
	duration_seconds int not null,
	sampling_rate int not null,
	avg_heart_rate int not null,
	min_hr int not null,
	max_hr int not null,
	source text not null
);

create table if not exists predictions (
	id uuid primary key,
	ecg_record_id uuid not null references ecg_records(id),
	predicted_at timestamptz not null,
	prediction_label text not null,
	arrhythmia_type text not null,
	confidence double precision not null,
	risk_score double precision not null,
	class_id int not null,
	features_json jsonb not null,
	model_version text not null
);

create table if not exists alerts (
	id uuid primary key,
	user_id uuid not null references users(id),
	ecg_record_id uuid not null references ecg_records(id),
	triggered_at timestamptz not null,
	alert_type text not null,
	severity text not null,
	message text not null,
	is_acknowledged boolean not null default false,
	acknowledged_at timestamptz
);


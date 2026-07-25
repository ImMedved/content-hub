# What is it? 
A modular social ecosystem framework with AI components. It allows users to create posts, communicate via private messages, and upload videos and audio files. AI automatically tags images to create a recommendation feed for users based on their preferences.

# Work plan

Fix and test video and audio file uploads/playback
Voice/Video direct messages
Group chats
Communities
Complete UI redesign
Text editor integration
Audio editor integration
Video editor integration
Voice calls

# Architecture

TODO

The contracts are described in [api] (docs/api.md)

# Deploy

docker compose up --build

## Recreate database

mysql -u [username] -p'[password]' -e "DROP DATABASE IF EXISTS \`SISIII2026_[student_number]\`; CREATE DATABASE \`SISIII2026_[student_number]\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" && mysql -u [username] -p'[password]' SISIII2026_[student_number] < database/schema.sql

## Deploy Linux

Might run without docker?

Requirements:

- `backend/.env` for runtime
- `backend/.env.test` for automated tests
- Node.js, npm, curl, maven, java 17
- Dataset for image analysis is not included on git

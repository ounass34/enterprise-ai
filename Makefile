up:
	docker compose --env-file .env -f docker-compose.yml up -d --build
up-gpu:
	docker compose --env-file .env -f docker-compose.yml -f docker-compose.gpu.yml up -d --build
down:
	docker compose down
logs:
	docker compose logs -f api
health:
	bash scripts/healthcheck.sh

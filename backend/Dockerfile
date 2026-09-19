# syntax=docker/dockerfile:1
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY backend/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY backend/src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /src/target/*.jar app.jar
# ECS Fargate has no host filesystem to bind-mount data/ from (unlike local
# docker-compose, which mounts ./data:/data:ro at runtime) - so the image has
# to carry its own copy. This build must run with the repo root as context:
#   docker build -f backend/Dockerfile -t yojana-backend .
COPY data /data
ENV YOJANA_DATA_DIR=/data
ENV SERVER_PORT=8081
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

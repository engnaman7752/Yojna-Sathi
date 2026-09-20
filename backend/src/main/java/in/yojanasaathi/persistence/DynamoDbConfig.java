package in.yojanasaathi.persistence;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClientBuilder;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;

/**
 * Wires the AWS SDK for DynamoDB.
 *
 * Two modes, one config:
 *
 * - Local dev: docker-compose brings up dynamodb-local at localhost:8001. Set
 *   `yojana.dynamodb.endpoint=http://localhost:8001` (or the env var
 *   DDB_ENDPOINT) and credentials are hard-coded to "local"/"local" - the
 *   local emulator ignores them but the SDK refuses to sign requests without
 *   any.
 *
 * - Real AWS: leave `yojana.dynamodb.endpoint` empty. The SDK's default
 *   credentials chain picks up the ECS task role (or your local
 *   ~/.aws/credentials for IntelliJ dev). Region comes from AWS_REGION or
 *   `yojana.dynamodb.region` (defaults to ap-south-1).
 *
 * The endpoint switch is the ONLY difference between the two modes so the
 * data-layer code cannot drift between them.
 */
@Configuration
public class DynamoDbConfig {

    @Value("${yojana.dynamodb.region:ap-south-1}")
    private String region;

    @Value("${yojana.dynamodb.endpoint:}")
    private String endpoint;

    @Bean
    DynamoDbClient dynamoDbClient() {
        DynamoDbClientBuilder builder = DynamoDbClient.builder()
                .region(Region.of(region));
        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create("local", "local")));
        } else {
            builder.credentialsProvider(DefaultCredentialsProvider.create());
        }
        return builder.build();
    }

    @Bean
    DynamoDbEnhancedClient dynamoDbEnhancedClient(DynamoDbClient client) {
        return DynamoDbEnhancedClient.builder().dynamoDbClient(client).build();
    }
}

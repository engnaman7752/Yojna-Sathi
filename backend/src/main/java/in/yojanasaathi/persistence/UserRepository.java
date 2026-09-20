package in.yojanasaathi.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryEnhancedRequest;

@Repository
public class UserRepository {
    private static final TableSchema<UserRecord> SCHEMA = TableSchema.fromBean(UserRecord.class);
    private final DynamoDbTable<UserRecord> table;

    public UserRepository(DynamoDbEnhancedClient enhanced,
            @Value("${yojana.dynamodb.table:YojanaSaathi}") String tableName) {
        this.table = enhanced.table(tableName, SCHEMA);
    }

    public UserRecord save(UserRecord rec) {
        rec.setPk("USER#" + rec.getEmail());
        rec.setSk("PROFILE");
        rec.setGsi3Pk("USER_STATUS#" + rec.getStatus());
        table.putItem(rec);
        return rec;
    }

    public Optional<UserRecord> findByEmail(String email) {
        Key key = Key.builder().partitionValue("USER#" + email).sortValue("PROFILE").build();
        return Optional.ofNullable(table.getItem(key));
    }

    public List<UserRecord> listByStatus(String status) {
        return table.index("GSI3").query(QueryEnhancedRequest.builder()
                .queryConditional(QueryConditional.keyEqualTo(
                        Key.builder().partitionValue("USER_STATUS#" + status).build()))
                .build())
                .stream()
                .flatMap(page -> page.items().stream())
                .toList();
    }
}

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
import software.amazon.awssdk.enhanced.dynamodb.model.ScanEnhancedRequest;

/**
 * DynamoDB-backed store for verification-pipeline applications.
 *
 * Replaces the in-memory ConcurrentHashMap that ApplicationController used
 * to hold. Reads and writes go through the enhanced client, indexes are
 * populated by ApplicationRecord's annotations.
 *
 * Kept intentionally small - this is not a generic DAO layer, it's the
 * specific queries ApplicationController needs.
 */
@Repository
public class ApplicationRepository {

    private static final TableSchema<ApplicationRecord> SCHEMA =
            TableSchema.fromBean(ApplicationRecord.class);

    private final DynamoDbTable<ApplicationRecord> table;

    public ApplicationRepository(DynamoDbEnhancedClient enhanced,
                                 @Value("${yojana.dynamodb.table:YojanaSaathi}") String tableName) {
        this.table = enhanced.table(tableName, SCHEMA);
    }

    public ApplicationRecord save(ApplicationRecord rec) {
        // Enforce the key layout even if callers forget - all key attributes
        // are derived from the domain fields.
        rec.setPk(Keys.applicationPk(rec.getId()));
        rec.setSk(Keys.applicationSk());
        rec.setGsi3Pk(Keys.applicationStatusGsi3Pk(rec.getStatus()));
        rec.setGsi3Sk(rec.getDateSubmitted());
        rec.setGsi2Pk(Keys.applicationDistrictGsi2Pk(rec.getDistrict()));
        rec.setGsi2Sk(Keys.applicationDistrictGsi2Sk(rec.getId(), rec.getDateSubmitted()));
        table.putItem(rec);
        return rec;
    }

    public Optional<ApplicationRecord> findById(String id) {
        Key key = Key.builder().partitionValue(Keys.applicationPk(id))
                .sortValue(Keys.applicationSk()).build();
        return Optional.ofNullable(table.getItem(key));
    }

    /**
     * All applications ordered newest first, optionally filtered to one
     * status. When status is null this scans the whole table - acceptable
     * while the row count is small (dev + demo). Once the table grows,
     * always pass a status and use the GSI3 query below.
     */
    public List<ApplicationRecord> listAll(String status) {
        if (status != null && !status.isBlank()) {
            return listByStatus(status);
        }
        // Full scan, sorted client-side because Scan does not honour any
        // ordering. Fine at hundreds of rows, wrong at millions - keep an
        // eye on it.
        return table.scan(ScanEnhancedRequest.builder().build())
                .items().stream()
                .sorted((a, b) -> b.getDateSubmitted().compareTo(a.getDateSubmitted()))
                .toList();
    }

    public List<ApplicationRecord> listByStatus(String status) {
        return table.index("GSI3").query(QueryEnhancedRequest.builder()
                        .queryConditional(QueryConditional.keyEqualTo(
                                Key.builder().partitionValue(
                                        Keys.applicationStatusGsi3Pk(status)).build()))
                        .scanIndexForward(false) // newest first
                        .build())
                .stream()
                .flatMap(page -> page.items().stream())
                .toList();
    }

    public List<ApplicationRecord> listByDistrict(String district) {
        return table.index("GSI2").query(QueryEnhancedRequest.builder()
                        .queryConditional(QueryConditional.keyEqualTo(
                                Key.builder().partitionValue(
                                        Keys.applicationDistrictGsi2Pk(district)).build()))
                        .scanIndexForward(false)
                        .build())
                .stream()
                .flatMap(page -> page.items().stream())
                .toList();
    }

    public static String nowIsoTimestamp() {
        return Instant.now().toString();
    }
}

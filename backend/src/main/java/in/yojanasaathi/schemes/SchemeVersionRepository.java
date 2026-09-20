package in.yojanasaathi.schemes;

import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import in.yojanasaathi.persistence.Keys;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbEnhancedClient;
import software.amazon.awssdk.enhanced.dynamodb.DynamoDbTable;
import software.amazon.awssdk.enhanced.dynamodb.Key;
import software.amazon.awssdk.enhanced.dynamodb.TableSchema;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryConditional;
import software.amazon.awssdk.enhanced.dynamodb.model.QueryEnhancedRequest;
import software.amazon.awssdk.enhanced.dynamodb.model.ScanEnhancedRequest;

/**
 * Persistence for the scheme editorial workflow (Session 5).
 *
 * This is the SOURCE OF TRUTH for scheme versions + their maker-checker
 * lifecycle. The eligibility engine still reads from disk (SchemeRepository)
 * for backward compatibility; on publish, SchemeController writes the JSON
 * to disk AND updates the record here, keeping them in sync.
 *
 * Kept small - four queries are all the endpoints need.
 */
@Repository
public class SchemeVersionRepository {

    private static final TableSchema<SchemeVersionRecord> SCHEMA =
            TableSchema.fromBean(SchemeVersionRecord.class);

    private final DynamoDbTable<SchemeVersionRecord> table;

    public SchemeVersionRepository(DynamoDbEnhancedClient enhanced,
                                   @Value("${yojana.dynamodb.table:YojanaSaathi}") String tableName) {
        this.table = enhanced.table(tableName, SCHEMA);
    }

    public SchemeVersionRecord save(SchemeVersionRecord rec) {
        rec.setPk(Keys.schemePk(rec.getSchemeId()));
        rec.setSk(Keys.schemeVersionSk(rec.getVersion()));
        rec.setGsi3Pk(Keys.schemeStatusGsi3Pk(rec.getStatus()));
        rec.setGsi3Sk(rec.getUpdatedAt());
        table.putItem(rec);
        return rec;
    }

    public Optional<SchemeVersionRecord> find(String schemeId, int version) {
        Key key = Key.builder()
                .partitionValue(Keys.schemePk(schemeId))
                .sortValue(Keys.schemeVersionSk(version))
                .build();
        return Optional.ofNullable(table.getItem(key));
    }

    /** All versions across all schemes. Ordered by scheme then version (natural PK/SK). */
    public List<SchemeVersionRecord> listAll() {
        return table.scan(ScanEnhancedRequest.builder().build())
                .items().stream()
                // Only scheme-version rows: PK begins with SCHEME# and SK begins with VERSION#
                .filter(r -> r.getSk() != null && r.getSk().startsWith("VERSION#"))
                .toList();
    }

    /** Versions in a given status (DRAFT/PUBLISHED/REJECTED), newest-updated first. */
    public List<SchemeVersionRecord> listByStatus(String status) {
        return table.index("GSI3").query(QueryEnhancedRequest.builder()
                        .queryConditional(QueryConditional.keyEqualTo(
                                Key.builder().partitionValue(Keys.schemeStatusGsi3Pk(status)).build()))
                        .scanIndexForward(false)
                        .build())
                .stream()
                .flatMap(page -> page.items().stream())
                .toList();
    }

    /** All versions of one scheme, ordered by version ascending. */
    public List<SchemeVersionRecord> listVersions(String schemeId) {
        return table.query(QueryEnhancedRequest.builder()
                        .queryConditional(QueryConditional.sortBeginsWith(
                                Key.builder().partitionValue(Keys.schemePk(schemeId))
                                        .sortValue("VERSION#").build()))
                        .scanIndexForward(true)
                        .build())
                .items().stream().toList();
    }
}

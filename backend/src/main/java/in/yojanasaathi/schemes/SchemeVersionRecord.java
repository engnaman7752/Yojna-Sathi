package in.yojanasaathi.schemes;

import java.util.Set;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

/**
 * One version of one scheme, stored in the single DynamoDB table.
 *
 * Key layout:
 *   PK   = SCHEME#<schemeId>
 *   SK   = VERSION#<n>         (each version is its own row)
 *   GSI3PK = SCHEME_STATUS#<status>   (list drafts/published across all schemes)
 *   GSI3SK = <updatedAt>
 *
 * Maker-checker: `drafter` is who created this version, `editors` is anyone
 * who has since edited it. Publish MUST reject an attempt by drafter OR any
 * editor - the same person cannot both write and approve. Enforced in
 * SchemeController.publish, not at the record layer.
 */
@DynamoDbBean
public class SchemeVersionRecord {
    private String pk;
    private String sk;
    private String gsi3Pk;
    private String gsi3Sk;

    private String schemeId;
    private Integer version;
    private String name;
    private String state;
    private String status;   // DRAFT | PUBLISHED | REJECTED
    private String drafter;  // Cognito sub of the creator
    private Set<String> editors;   // Cognito subs of anyone who edited the draft
    private String publishedBy;    // Cognito sub of the approver (null until published)
    private String updatedAt;      // ISO timestamp of last change
    private String publishedAt;    // ISO timestamp of publish (null until published)
    private String body;           // The whole scheme JSON as text (conditions etc.)

    @DynamoDbPartitionKey
    @DynamoDbAttribute("PK")
    public String getPk() { return pk; }
    public void setPk(String v) { this.pk = v; }

    @DynamoDbSortKey
    @DynamoDbAttribute("SK")
    public String getSk() { return sk; }
    public void setSk(String v) { this.sk = v; }

    @DynamoDbSecondaryPartitionKey(indexNames = "GSI3")
    @DynamoDbAttribute("GSI3PK")
    public String getGsi3Pk() { return gsi3Pk; }
    public void setGsi3Pk(String v) { this.gsi3Pk = v; }

    @DynamoDbSecondarySortKey(indexNames = "GSI3")
    @DynamoDbAttribute("GSI3SK")
    public String getGsi3Sk() { return gsi3Sk; }
    public void setGsi3Sk(String v) { this.gsi3Sk = v; }

    public String getSchemeId() { return schemeId; }
    public void setSchemeId(String v) { this.schemeId = v; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer v) { this.version = v; }

    public String getName() { return name; }
    public void setName(String v) { this.name = v; }

    public String getState() { return state; }
    public void setState(String v) { this.state = v; }

    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }

    public String getDrafter() { return drafter; }
    public void setDrafter(String v) { this.drafter = v; }

    public Set<String> getEditors() { return editors; }
    public void setEditors(Set<String> v) { this.editors = v; }

    public String getPublishedBy() { return publishedBy; }
    public void setPublishedBy(String v) { this.publishedBy = v; }

    public String getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(String v) { this.updatedAt = v; }

    public String getPublishedAt() { return publishedAt; }
    public void setPublishedAt(String v) { this.publishedAt = v; }

    public String getBody() { return body; }
    public void setBody(String v) { this.body = v; }
}

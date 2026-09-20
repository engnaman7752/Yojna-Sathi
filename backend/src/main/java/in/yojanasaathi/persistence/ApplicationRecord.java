package in.yojanasaathi.persistence;

import java.util.List;

import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbAttribute;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbBean;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondaryPartitionKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSecondarySortKey;
import software.amazon.awssdk.enhanced.dynamodb.mapper.annotations.DynamoDbSortKey;

/**
 * DynamoDB enhanced bean for one application row.
 *
 * Key layout (single table):
 *   PK   = APP#<id>
 *   SK   = META
 *   GSI2PK = DISTRICT#<district>            (list by district)
 *   GSI2SK = <dateSubmitted>#APP#<id>       (sorted newest-first)
 *   GSI3PK = APP_STATUS#<status>            (list by status - VDO/BDO queues)
 *   GSI3SK = <dateSubmitted>                (sorted newest-first)
 *
 * Enhanced client requires a no-arg constructor and getters/setters, so this
 * is a plain mutable bean rather than a record. Immutability lives at the
 * repository boundary (Application record in the controller layer).
 */
@DynamoDbBean
public class ApplicationRecord {
    private String pk;
    private String sk;
    private String gsi2Pk;
    private String gsi2Sk;
    private String gsi3Pk;
    private String gsi3Sk;

    private String id;
    private String applicant;
    private String scheme;
    private String district;
    private String status;
    private List<String> documents;
    private String dateSubmitted;

    @DynamoDbPartitionKey
    @DynamoDbAttribute("PK")
    public String getPk() { return pk; }
    public void setPk(String pk) { this.pk = pk; }

    @DynamoDbSortKey
    @DynamoDbAttribute("SK")
    public String getSk() { return sk; }
    public void setSk(String sk) { this.sk = sk; }

    @DynamoDbSecondaryPartitionKey(indexNames = "GSI2")
    @DynamoDbAttribute("GSI2PK")
    public String getGsi2Pk() { return gsi2Pk; }
    public void setGsi2Pk(String v) { this.gsi2Pk = v; }

    @DynamoDbSecondarySortKey(indexNames = "GSI2")
    @DynamoDbAttribute("GSI2SK")
    public String getGsi2Sk() { return gsi2Sk; }
    public void setGsi2Sk(String v) { this.gsi2Sk = v; }

    @DynamoDbSecondaryPartitionKey(indexNames = "GSI3")
    @DynamoDbAttribute("GSI3PK")
    public String getGsi3Pk() { return gsi3Pk; }
    public void setGsi3Pk(String v) { this.gsi3Pk = v; }

    @DynamoDbSecondarySortKey(indexNames = "GSI3")
    @DynamoDbAttribute("GSI3SK")
    public String getGsi3Sk() { return gsi3Sk; }
    public void setGsi3Sk(String v) { this.gsi3Sk = v; }

    public String getId() { return id; }
    public void setId(String v) { this.id = v; }

    public String getApplicant() { return applicant; }
    public void setApplicant(String v) { this.applicant = v; }

    public String getScheme() { return scheme; }
    public void setScheme(String v) { this.scheme = v; }

    public String getDistrict() { return district; }
    public void setDistrict(String v) { this.district = v; }

    public String getStatus() { return status; }
    public void setStatus(String v) { this.status = v; }

    public List<String> getDocuments() { return documents; }
    public void setDocuments(List<String> v) { this.documents = v; }

    public String getDateSubmitted() { return dateSubmitted; }
    public void setDateSubmitted(String v) { this.dateSubmitted = v; }
}

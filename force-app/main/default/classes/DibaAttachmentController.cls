/**
 * The attachments of an account (AttachmentView of IBA-Salesforce): the logo (slot 0, JPEG)
 * and one PDF after each of six chapters (slots 1 to 6), at most 20 MB each. They are
 * Salesforce Files on the account; the slot is a field of the file version.
 *
 * PDFs go up with lightning-file-upload and are then assigned to their slot; the logo is
 * converted to JPEG in the browser and comes here as Base64, it is small.
 */
public with sharing class DibaAttachmentController {
    public static final Integer MAX_BYTES = 20971520;
    public static final Integer LOGO = 0;

    public class Attachment {
        @AuraEnabled
        public Integer slot;
        @AuraEnabled
        public Id documentId;
        @AuraEnabled
        public Id versionId;
        @AuraEnabled
        public String fileName;
        @AuraEnabled
        public Integer size;
        @AuraEnabled
        public Datetime updated;
    }

    /** The files of the account that have a slot, by slot. */
    @AuraEnabled
    public static Map<Integer, Attachment> listAttachments(Id accountDataId) {
        Map<Integer, Attachment> result = new Map<Integer, Attachment>();
        for (ContentVersion version : versions(accountDataId)) {
            Attachment attachment = new Attachment();
            attachment.slot = version.DIBA_Slot__c.intValue();
            attachment.documentId = version.ContentDocumentId;
            attachment.versionId = version.Id;
            attachment.fileName = version.PathOnClient;
            attachment.size = version.ContentSize;
            attachment.updated = version.CreatedDate;
            result.put(attachment.slot, attachment);
        }
        return result;
    }

    private static List<ContentVersion> versions(Id accountDataId) {
        Set<Id> documents = new Set<Id>();
        for (ContentDocumentLink link : [
            SELECT ContentDocumentId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :accountDataId
        ]) {
            documents.add(link.ContentDocumentId);
        }
        return [
            SELECT Id, ContentDocumentId, PathOnClient, ContentSize, CreatedDate, DIBA_Slot__c
            FROM ContentVersion
            WHERE ContentDocumentId IN :documents AND IsLatest = TRUE AND DIBA_Slot__c != NULL
            ORDER BY CreatedDate
        ];
    }

    /** Removes what is in the slot, except the given document. */
    private static void clear(Id accountDataId, Integer slot, Id keep) {
        List<ContentDocument> old = new List<ContentDocument>();
        for (ContentVersion version : versions(accountDataId)) {
            if (version.DIBA_Slot__c.intValue() == slot && version.ContentDocumentId != keep) {
                old.add(new ContentDocument(Id = version.ContentDocumentId));
            }
        }
        delete old;
    }

    private static void checkSlot(Integer slot, Boolean logo) {
        if (slot == null || slot < (logo ? 0 : 1) || slot > (logo ? 0 : 6)) {
            throw new AuraHandledException('Unknown attachment slot ' + slot + '.');
        }
    }

    /**
     * Assigns a PDF uploaded with lightning-file-upload to its slot; the PDF that was there
     * before is removed. A file that is not a PDF or larger than 20 MB is removed again.
     */
    @AuraEnabled
    public static Attachment assign(Id accountDataId, Integer slot, Id documentId) {
        checkSlot(slot, false);
        ContentVersion version = [
            SELECT Id, ContentDocumentId, PathOnClient, ContentSize, FileExtension, CreatedDate
            FROM ContentVersion
            WHERE ContentDocumentId = :documentId AND IsLatest = TRUE
        ];
        String problem = null;
        if (version.FileExtension == null || version.FileExtension.toLowerCase() != 'pdf') {
            problem = 'Only PDF files can be attached.';
        } else if (version.ContentSize > MAX_BYTES) {
            problem = 'The file has more than 20 MB.';
        }
        if (problem != null) {
            delete new ContentDocument(Id = documentId);
            throw new AuraHandledException(problem);
        }
        version.DIBA_Slot__c = slot;
        update version;
        clear(accountDataId, slot, documentId);
        return listAttachments(accountDataId).get(slot);
    }

    /** Stores the logo, already converted to JPEG by the browser. */
    @AuraEnabled
    public static Attachment uploadLogo(Id accountDataId, String fileName, String base64Jpeg) {
        Blob content = EncodingUtil.base64Decode(base64Jpeg);
        if (content.size() > MAX_BYTES) {
            throw new AuraHandledException('The file has more than 20 MB.');
        }
        ContentVersion version = new ContentVersion(
            Title = fileName,
            PathOnClient = fileName,
            VersionData = content,
            FirstPublishLocationId = accountDataId,
            DIBA_Slot__c = LOGO
        );
        insert version;
        Id documentId = [SELECT ContentDocumentId FROM ContentVersion WHERE Id = :version.Id]
        .ContentDocumentId;
        clear(accountDataId, LOGO, documentId);
        return listAttachments(accountDataId).get(LOGO);
    }

    @AuraEnabled
    public static void remove(Id accountDataId, Integer slot) {
        checkSlot(slot, slot == LOGO);
        clear(accountDataId, slot, null);
    }
}

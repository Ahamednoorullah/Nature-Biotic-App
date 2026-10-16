-- Company receipts use the same document sequence as other company documents.
-- Existing receipt numbers are left unchanged. Only the next allocated prefix changes.
update public.document_sequences
   set prefix = 'NB-RCP-'
 where doc_type = 'company_receipt'
   and scope_key = 'GLOBAL'
   and prefix = 'RCP-';

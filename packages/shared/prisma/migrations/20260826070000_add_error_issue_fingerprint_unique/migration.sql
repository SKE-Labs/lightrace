-- CreateIndex
CREATE UNIQUE INDEX "error_issues_project_id_fingerprint_key" ON "error_issues"("project_id", "fingerprint");

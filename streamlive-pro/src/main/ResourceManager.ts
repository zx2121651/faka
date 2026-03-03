export class ResourceManager {
  private resources: any[] = [];

  constructor() {
    this.resources = [];
  }

  async uploadResource(file: File): Promise<string> {
    // 模拟上传资源
    console.log(`Resource uploaded: ${file.name}`);
    const resourceId = `res_${Date.now()}`;
    this.resources.push({ id: resourceId, name: file.name, path: file.path });
    return resourceId;
  }

  getResourceList(): any[] {
    return this.resources;
  }

  async deleteResource(resourceId: string): Promise<boolean> {
    console.log(`Deleting resource: ${resourceId}`);
    this.resources = this.resources.filter((res) => res.id !== resourceId);
    return true;
  }

  validateResourceData(resourceId: string): boolean {
    return this.resources.some((res) => res.id === resourceId);
  }

  getStorageUsage(): number {
    return this.resources.length * 1024 * 1024; // Dummy 1MB per resource
  }
}

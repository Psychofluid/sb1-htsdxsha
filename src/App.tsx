import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Image as ImageIcon, 
  Maximize, 
  Grid2X2, 
  Sun, 
  Moon, 
  RotateCw,
  X,
  Package
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Define types
type Orientation = 'portrait' | 'landscape';
type PaperFormat = 'A4' | 'A3' | 'A2' | 'custom';

interface Dimensions {
  width: number;
  height: number;
}

interface ImageSection {
  dataUrl: string;
  dimensions: {
    width: number;
    height: number;
  };
}

const PAPER_FORMATS: Record<PaperFormat, Dimensions> = {
  'A4': { width: 21, height: 29.7 },
  'A3': { width: 29.7, height: 42 },
  'A2': { width: 42, height: 59.4 },
  'custom': { width: 20, height: 20 }, // Default custom dimensions
};

function App() {
  // State management
  const [darkMode, setDarkMode] = useState(false);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [customDimensions, setCustomDimensions] = useState<Dimensions>({ width: 20, height: 20 });
  const [splitSections, setSplitSections] = useState<ImageSection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Toggle dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validFileTypes = ['image/jpeg', 'image/png', 'image/tiff'];
    if (!validFileTypes.includes(file.type)) {
      setError('Invalid file type. Please upload JPG, PNG, or TIFF.');
      return;
    }
    setError(null);

    // Get file name and type
    setFileName(file.name);
    setFileType(file.type);

    // Create image object for processing
    const img = new Image();
    img.onload = () => {
      setSourceImage(img);
      // Clear previous sections when a new image is uploaded
      setSplitSections([]);
    };
    img.onerror = () => {
      setError('Failed to load image. Please try another file.');
    };
    img.src = URL.createObjectURL(file);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files[0];
    if (file) {
      const dummyInput = document.createElement('input');
      dummyInput.type = 'file';
      dummyInput.files = e.dataTransfer.files;
      const event = { target: dummyInput } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileUpload(event);
    }
  };

  // Toggle orientation
  const toggleOrientation = () => {
    setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait');
  };

  // Get current dimensions based on format and orientation
  const getCurrentDimensions = (): Dimensions => {
    const baseDimensions = paperFormat === 'custom' ? customDimensions : PAPER_FORMATS[paperFormat];
    return orientation === 'landscape' 
      ? { width: baseDimensions.height, height: baseDimensions.width } 
      : baseDimensions;
  };

  // Process and split the image
  const processImage = () => {
    if (!sourceImage) return;
    
    setIsProcessing(true);
    
    // Get the current dimensions
    const outputDimensions = getCurrentDimensions();
    
    // Create a canvas to process the image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      setError('Canvas not supported in your browser.');
      setIsProcessing(false);
      return;
    }
    
    // Set canvas size to match the original image for better quality
    canvas.width = sourceImage.width;
    canvas.height = sourceImage.height;
    
    // Draw the original image
    ctx.drawImage(sourceImage, 0, 0);
    
    // Get the image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Calculate the width and height for each section
    const halfWidth = canvas.width / 2;
    const halfHeight = canvas.height / 2;
    
    // Create 4 separate canvases for the sections
    const sections: ImageSection[] = [];
    
    // Helper function to create section
    const createSection = (x: number, y: number, width: number, height: number) => {
      const sectionCanvas = document.createElement('canvas');
      sectionCanvas.width = width;
      sectionCanvas.height = height;
      
      const sectionCtx = sectionCanvas.getContext('2d');
      if (!sectionCtx) return null;
      
      // Draw the section from the original image
      sectionCtx.drawImage(
        sourceImage,
        x, y, width, height,
        0, 0, width, height
      );
      
      return {
        dataUrl: sectionCanvas.toDataURL('image/png'),
        dimensions: {
          width: outputDimensions.width / 2,
          height: outputDimensions.height / 2
        }
      };
    };
    
    // Top-left section
    sections.push(createSection(0, 0, halfWidth, halfHeight)!);
    
    // Top-right section
    sections.push(createSection(halfWidth, 0, halfWidth, halfHeight)!);
    
    // Bottom-left section
    sections.push(createSection(0, halfHeight, halfWidth, halfHeight)!);
    
    // Bottom-right section
    sections.push(createSection(halfWidth, halfHeight, halfWidth, halfHeight)!);
    
    // Update state with the sections
    setSplitSections(sections);
    setIsProcessing(false);
  };

  // Handle downloading a single section
  const downloadSection = (dataUrl: string, index: number) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${fileName.split('.')[0]}_section_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle downloading all sections as a ZIP
  const downloadAllSections = async () => {
    if (splitSections.length === 0) return;
    
    const zip = new JSZip();
    const imgFolder = zip.folder("split_images");
    
    if (!imgFolder) return;
    
    // Add each section to the ZIP
    splitSections.forEach((section, index) => {
      // Convert data URL to blob
      const base64Data = section.dataUrl.split(',')[1];
      imgFolder.file(`${fileName.split('.')[0]}_section_${index + 1}.png`, base64Data, { base64: true });
    });
    
    // Generate and download the ZIP file
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${fileName.split('.')[0]}_split_images.zip`);
  };

  // Preview a section in full size
  const previewSection = (dataUrl: string) => {
    setPreviewImageUrl(dataUrl);
    setIsPreviewOpen(true);
  };

  // Close the preview
  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewImageUrl(null);
  };

  // Get display dimensions in cm
  const getDisplayDimensions = (dimensions: Dimensions) => {
    return `${dimensions.width.toFixed(1)} × ${dimensions.height.toFixed(1)} cm`;
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark:bg-gray-900 dark:text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Grid2X2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <span className="ml-2 text-xl font-bold">ImageSplitter</span>
            </div>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-lg">
            <p>{error}</p>
          </div>
        )}

        {/* Input Section */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Upload Your Image</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div 
              className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <Upload size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg mb-2">Drag & drop your image here</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Supported formats: JPG, PNG, TIFF</p>
              <input 
                id="file-upload" 
                type="file" 
                accept=".jpg,.jpeg,.png,.tiff" 
                className="hidden" 
                onChange={handleFileUpload} 
              />
              <button className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-md transition-colors">
                Browse Files
              </button>
              
              {sourceImage && (
                <div className="mt-4 text-center">
                  <p className="font-semibold text-green-600 dark:text-green-400">Image loaded: {fileName}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Original size: {sourceImage.width} × {sourceImage.height} px
                  </p>
                </div>
              )}
            </div>

            <div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">Output Settings</h3>
                
                {/* Format Selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">Paper Format</label>
                  <div className="grid grid-cols-4 gap-2">
                    {Object.keys(PAPER_FORMATS).map((format) => (
                      <button
                        key={format}
                        className={`py-2 px-3 rounded-md text-sm font-medium ${
                          paperFormat === format 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        onClick={() => setPaperFormat(format as PaperFormat)}
                      >
                        {format}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Custom Dimensions */}
                {paperFormat === 'custom' && (
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Width (cm)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={customDimensions.width}
                        onChange={(e) => setCustomDimensions(prev => ({ ...prev, width: parseFloat(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Height (cm)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={customDimensions.height}
                        onChange={(e) => setCustomDimensions(prev => ({ ...prev, height: parseFloat(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700"
                      />
                    </div>
                  </div>
                )}
                
                {/* Orientation */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">Orientation</label>
                  <div className="flex items-center space-x-4">
                    <button
                      className={`flex items-center justify-center p-3 rounded-md ${
                        orientation === 'portrait' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                      onClick={() => setOrientation('portrait')}
                    >
                      <div className="h-6 w-4 border-2 border-current rounded-sm"></div>
                      <span className="ml-2">Portrait</span>
                    </button>
                    <button
                      className={`flex items-center justify-center p-3 rounded-md ${
                        orientation === 'landscape' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}
                      onClick={() => setOrientation('landscape')}
                    >
                      <div className="h-4 w-6 border-2 border-current rounded-sm"></div>
                      <span className="ml-2">Landscape</span>
                    </button>
                    <button
                      className="p-2 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                      onClick={toggleOrientation}
                      aria-label="Toggle orientation"
                    >
                      <RotateCw size={20} />
                    </button>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    Output size: {getDisplayDimensions(getCurrentDimensions())}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Each section: {getDisplayDimensions({
                      width: getCurrentDimensions().width / 2,
                      height: getCurrentDimensions().height / 2
                    })}
                  </p>

                  <button
                    className="w-full bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white py-2 px-4 rounded-md disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                    onClick={processImage}
                    disabled={!sourceImage || isProcessing}
                  >
                    {isProcessing ? 'Processing...' : 'Split Image'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Output Section */}
        {splitSections.length > 0 && (
          <section className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Split Sections</h2>
              <button
                className="flex items-center bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-md transition-colors"
                onClick={downloadAllSections}
              >
                <Package size={18} className="mr-2" />
                Download All
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
              {splitSections.map((section, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                  <div className="relative aspect-square bg-gray-100 dark:bg-gray-900">
                    <img 
                      src={section.dataUrl} 
                      alt={`Section ${index + 1}`} 
                      className="w-full h-full object-contain"
                    />
                    <button
                      className="absolute top-2 right-2 p-2 bg-gray-800 bg-opacity-70 hover:bg-opacity-90 rounded-full text-white"
                      onClick={() => previewSection(section.dataUrl)}
                      aria-label="Preview"
                    >
                      <Maximize size={16} />
                    </button>
                  </div>
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold">Section {index + 1}</h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {section.dimensions.width.toFixed(1)} × {section.dimensions.height.toFixed(1)} cm
                      </span>
                    </div>
                    <button
                      className="w-full flex items-center justify-center mt-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white px-4 py-2 rounded-md transition-colors"
                      onClick={() => downloadSection(section.dataUrl, index)}
                    >
                      <Download size={16} className="mr-2" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Image Preview Modal */}
      {isPreviewOpen && previewImageUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative max-w-4xl max-h-full">
            <button
              className="absolute top-4 right-4 p-2 bg-gray-800 bg-opacity-70 hover:bg-opacity-90 rounded-full text-white z-10"
              onClick={closePreview}
              aria-label="Close preview"
            >
              <X size={24} />
            </button>
            <img 
              src={previewImageUrl} 
              alt="Preview" 
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 py-6 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-gray-500 dark:text-gray-400">
            ImageSplitter — A tool for dividing images into equal sections
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
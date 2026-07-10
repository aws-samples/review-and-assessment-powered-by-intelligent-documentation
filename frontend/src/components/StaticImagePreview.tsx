import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import Button from "./Button";
import { HiZoomIn, HiZoomOut, HiDownload } from "react-icons/hi";
import { FiRefreshCw } from "react-icons/fi";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { publicAsset } from "../utils/publicAsset";

interface StaticImagePreviewProps {
  imageUrl: string; // Direct URL like /examples/images/...
  filename: string;
  thumbnailHeight?: number;
  documentUrl?: string; // Optional: original document URL for download
}

/**
 * Static Image Preview Component with Zoom Functionality
 * Simplified version of ImagePreview for public static images (not S3)
 * Includes zoom/pan/pinch controls powered by react-zoom-pan-pinch
 */
export default function StaticImagePreview({
  imageUrl,
  filename,
  thumbnailHeight = 80,
  documentUrl,
}: StaticImagePreviewProps) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  // Resolve public asset paths against the app base (stage prefix, e.g. "/app/").
  const resolvedImageUrl = publicAsset(imageUrl);

  return (
    <>
      <div className="flex w-full flex-col items-start">
        <div
          className="hover:border-aws-smile-blue relative w-full cursor-pointer overflow-hidden rounded border border-light-gray transition-all"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={() => setIsModalOpen(true)}>
          <img
            ref={imageRef}
            src={resolvedImageUrl}
            alt={filename}
            style={{ height: thumbnailHeight }}
            className="w-full object-cover transition-opacity"
          />

          {/* Hover overlay with zoom icon */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-60 transition-opacity duration-200 ${
              isHovering ? "opacity-100" : "opacity-0"
            }`}>
            <HiZoomIn className="mb-1 h-5 w-5 text-white" />
            <span className="text-[10px] text-white">
              {t("imagePreview.zoomView")}
            </span>
          </div>
        </div>

        {/* Filename label */}
        <p
          className="mt-1 w-full truncate text-[10px] text-aws-font-color-gray"
          title={filename}>
          {filename}
        </p>
      </div>

      {/* Modal with Zoom Controls */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={filename}
          size="lg">
          <div className="flex w-full flex-col items-center">
            <TransformWrapper
              initialScale={1}
              initialPositionX={0}
              initialPositionY={0}
              minScale={0.5}
              maxScale={5}
              wheel={{ step: 0.1 }}
              centerOnInit={true}>
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Zoom Controls */}
                  <div className="mb-3 flex w-full justify-center gap-2">
                    <Button
                      onClick={() => zoomIn()}
                      variant="secondary"
                      size="sm"
                      icon={<HiZoomIn className="h-4 w-4" />}>
                      {t("imagePreview.zoomIn")}
                    </Button>
                    <Button
                      onClick={() => zoomOut()}
                      variant="secondary"
                      size="sm"
                      icon={<HiZoomOut className="h-4 w-4" />}>
                      {t("imagePreview.zoomOut")}
                    </Button>
                    <Button
                      onClick={() => resetTransform()}
                      variant="secondary"
                      size="sm"
                      icon={<FiRefreshCw className="h-4 w-4" />}>
                      {t("imagePreview.reset")}
                    </Button>
                  </div>

                  {/* Zoomable Image */}
                  <div className="flex w-full justify-center">
                    <TransformComponent
                      wrapperStyle={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                      }}>
                      <img
                        src={resolvedImageUrl}
                        alt={filename}
                        className="max-h-[60vh] max-w-full object-contain"
                      />
                    </TransformComponent>
                  </div>
                </>
              )}
            </TransformWrapper>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t("common.close")}
            </Button>
            {documentUrl && (
              <Button
                variant="primary"
                onClick={() => window.open(documentUrl, "_blank")}
                icon={<HiDownload size={16} />}>
                {t("imagePreview.download")}
              </Button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

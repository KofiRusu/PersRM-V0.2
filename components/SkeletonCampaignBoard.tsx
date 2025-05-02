import { motion } from 'framer-motion';

export function SkeletonCampaignBoard() {
  return (
    <motion.div 
      initial={{ opacity: 0.6 }}
      animate={{ opacity: 0.8 }}
      transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
      className="flex gap-4 overflow-x-auto h-full pb-4"
    >
      {Array(5).fill(0).map((_, i) => (
        <div key={i} className="flex flex-col min-w-[250px] h-full rounded-md shadow-sm border bg-gray-100">
          <div className="h-10 bg-gray-200 rounded-t-md" />
          <div className="flex-1 p-2 space-y-2">
            {Array(i + 2).fill(0).map((_, j) => (
              <div key={j} className="h-20 bg-white rounded-md border" />
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
} 
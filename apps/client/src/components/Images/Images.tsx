import useSWR from 'swr'
import {
  Box,
  Image,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  Text,
  Flex,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
} from '@chakra-ui/react'
import { DateTime } from 'luxon'
import { cdnURL } from '../../lib/cdn'
import { Link, useNavigate } from 'react-router-dom'

export default function Images() {
  const navigate = useNavigate()
  const { data, isLoading } = useSWR('/images')

  function handleNavigate(id: string) {
    navigate(`/images/${id}`)
  }

  const bg = useColorModeValue('gray.100', 'gray.700')
  return (
    <Box>
      <Breadcrumb fontWeight="medium" fontSize="lg">
        <BreadcrumbItem>
          <BreadcrumbLink as={Link} to="/images">
            Images
          </BreadcrumbLink>
        </BreadcrumbItem>
      </Breadcrumb>
      {!isLoading && data && (
        <TableContainer>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th></Th>
                <Th>ID</Th>
                <Th isNumeric>Created</Th>
              </Tr>
            </Thead>
            <Tbody>
              {data.map((image: any) => {
                const imageUrl = cdnURL(
                  `images/${image.id}?fmt=jpeg&q=30&w=100&h=100`
                )
                return (
                  <Tr
                    id={image.id}
                    key={image.id}
                    _hover={{ bg }}
                    cursor="pointer"
                    onClick={() => {
                      handleNavigate(image.id)
                    }}
                  >
                    <Td w="100px" minW="100px">
                      <Image
                        boxSize="50px"
                        rounded="sm"
                        src={imageUrl}
                        alt={image.id}
                      />
                    </Td>
                    <Td>
                      <Text fontSize=".8em">{image.id}</Text>
                    </Td>
                    <Td isNumeric>
                      <Box>
                        {DateTime.fromISO(image?.createdAt).toFormat(
                          'MM/dd/yy hh:mm a'
                        )}
                      </Box>
                    </Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </TableContainer>
      )}
      <Flex p="2" justify="center">
        <Text>{`${data?.length} Images`}</Text>
      </Flex>
    </Box>
  )
}